import { Uri, Webview, workspace } from "vscode";
import { OutboundEvents, LoadingSteps } from "../../constants";
import {
  FilePatterns,
  FileLimits,
  PathPatterns,
  MessageStrings,
  MessageFormats,
} from "../../constants";
import type { Selection, ProjectContext } from "../../domain/entities/Selection";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class ProjectContextService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ProjectContextService", loggingService);
  }
  async buildContext(
    snippet: string,
    filePath?: string,
    languageId?: string,
    webview?: Webview,
  ): Promise<ProjectContext> {
    const startTime = Date.now();
    this.logger.debug("ProjectContextService.buildContext started", {
      snippetLength: snippet?.length || 0,
      filePath,
      languageId,
    });

    const foldersStart = Date.now();
    const folders = workspace.workspaceFolders;
    const rootName = folders && folders.length ? folders[0].name : "";
    this.logger.debug("Workspace folders retrieved", {
      duration: Date.now() - foldersStart,
      rootName,
      folderCount: folders?.length || 0,
    });

    const findFilesStart = Date.now();
    this.logger.debug("Finding project files", {
      pattern: FilePatterns.allFiles.toString(),
      maxFiles: FileLimits.projectFiles,
    });
    const files = await workspace.findFiles(
      FilePatterns.allFiles,
      FilePatterns.exclude,
      FileLimits.projectFiles,
    );
    this.logger.debug("Project files found", {
      duration: Date.now() - findFilesStart,
      fileCount: files.length,
    });

    const filesSampleStart = Date.now();
    const filesSample = files.slice(0, FileLimits.maxFileSample).map(this.relativePath);
    this.logger.debug("Files sample created", {
      duration: Date.now() - filesSampleStart,
      sampleCount: filesSample.length,
    });

    const overviewStart = Date.now();
    this.logger.debug("Reading project overview");
    const overview = await this.readOverview();
    this.logger.debug("Project overview read", {
      duration: Date.now() - overviewStart,
      overviewLength: overview?.length || 0,
    });

    if (webview) {
      this.logger.debug("Sending loading step to webview", { step: LoadingSteps.finding });
      webview.postMessage({
        command: OutboundEvents.loadingStep,
        payload: { step: LoadingSteps.finding },
      });
    }

    const extractTokenStart = Date.now();
    this.logger.debug("Extracting identifier from snippet", {
      snippetLength: snippet?.length || 0,
    });
    const extractedToken = this.extractIdentifier(snippet);
    const baseNameToken = this.baseName(filePath);
    const token = extractedToken || baseNameToken;
    this.logger.debug("Token extraction completed", {
      duration: Date.now() - extractTokenStart,
      extractedToken,
      baseNameToken,
      finalToken: token || "none",
    });

    let related: Array<{ path: string; preview?: string; line?: number; reason?: string }> = [];
    if (token) {
      const findUsagesStart = Date.now();
      this.logger.debug("Finding text usages", { token });
      related = await this.findTextUsages(token);
      this.logger.debug("Text usages found", {
        duration: Date.now() - findUsagesStart,
        relatedCount: related.length,
      });
    } else {
      this.logger.debug("No token found, skipping text usage search");
    }

    const result = { rootName, overview, filesSample, related };
    this.logger.debug("ProjectContextService.buildContext completed", {
      totalDuration: Date.now() - startTime,
      rootName: result.rootName,
      filesSampleCount: result.filesSample.length,
      relatedCount: result.related.length,
      overviewLength: result.overview.length,
    });
    return result;
  }

  private baseName(p?: string) {
    if (!p || typeof p !== "string") return undefined;
    const m = PathPatterns.baseNameRegex.exec(p);
    return m ? m[0] : p;
  }

  private relativePath(u: Uri) {
    const folders = workspace.workspaceFolders;
    if (!folders || !folders.length) return u.fsPath;
    const root = folders[0].uri.fsPath.replace(PathPatterns.escapeCharRegex, "");
    const fsPath = u.fsPath || "";
    return fsPath.startsWith(root) ? fsPath.slice(root.length + 1) : fsPath;
  }

  private extractIdentifier(text: string) {
    const startTime = Date.now();
    this.logger.debug("extractIdentifier started", { textLength: text?.length || 0 });

    if (!text || typeof text !== "string") {
      this.logger.debug("extractIdentifier: invalid input");
      return undefined;
    }

    const lines = text.split("\n");
    const candidates: string[] = [];
    const combinedPattern =
      /(?:(?:function|const|let|var|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)|export\s+(?:default\s+)?(?:function|class|const|let|var)?\s*([a-zA-Z_][a-zA-Z0-9_]*)|import.*from\s+['"]([^'"]+)['"]|(?:interface|type)\s+([a-zA-Z_][a-zA-Z0-9_]*))/;

    this.logger.debug("Scanning lines for identifiers", { lineCount: lines.length });
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(combinedPattern);
      if (match) {
        const identifier = match[1] || match[2] || match[3] || match[4];
        if (identifier) {
          candidates.push(identifier);
        }
      }
    }

    this.logger.debug("Pattern matching completed", { candidateCount: candidates.length });

    if (candidates.length === 0) {
      this.logger.debug("No candidates from patterns, trying fallback regex");
      const matches = text.match(PathPatterns.identifierRegex);
      if (matches && matches.length) {
        this.logger.debug("Fallback regex found matches", { matchCount: matches.length });
        const scored = matches.map((t) => ({
          t,
          score: (/[A-Z]/.test(t) ? 1 : 0) + t.length / 10,
        }));
        scored.sort((a, b) => b.score - a.score);
        const result = scored[0].t;
        this.logger.debug("extractIdentifier completed (fallback)", {
          duration: Date.now() - startTime,
          result,
        });
        return result;
      }
    }

    const scored = candidates.map((t) => ({ t, score: (/[A-Z]/.test(t) ? 2 : 1) + t.length / 10 }));
    scored.sort((a, b) => b.score - a.score);
    const result = scored[0]?.t;
    this.logger.debug("extractIdentifier completed", {
      duration: Date.now() - startTime,
      candidateCount: candidates.length,
      result,
    });
    return result;
  }

  private async findTextUsages(token: string) {
    const startTime = Date.now();
    this.logger.debug("findTextUsages started", { token });

    const related: Array<{ path: string; preview?: string; line?: number; reason?: string }> = [];

    const findFilesStart = Date.now();
    this.logger.debug("Finding files for text usage search", {
      maxFiles: FileLimits.relatedFiles,
    });
    const files = await workspace.findFiles(
      FilePatterns.allFiles,
      FilePatterns.exclude,
      FileLimits.relatedFiles,
    );
    this.logger.debug("Files found for text usage search", {
      duration: Date.now() - findFilesStart,
      fileCount: files.length,
    });

    const escapedToken = (token || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const combinedPattern = new RegExp(
      `\\b(?:function|const|let|var|class|interface|type)\\s+${escapedToken}\\b|\\bexport\\s+(?:default\\s+)?(?:function|class|const|let|var)?\\s*${escapedToken}\\b|\\bimport.*from\\s+['"]${escapedToken}['"]|\\b${escapedToken}\\s*\\(`,
    );
    this.logger.debug("Search pattern created", { pattern: combinedPattern.toString() });

    let processedCount = 0;
    let skippedBinaryCount = 0;
    let matchedCount = 0;
    let errorCount = 0;

    const filePromises = files.map(async (uri, index) => {
      try {
        const binaryExtensions =
          /\.(png|jpg|jpeg|gif|bmp|ico|svg|mp4|avi|mov|wmv|flv|webm|mp3|wav|ogg|flac|aac|pdf|zip|rar|tar|gz|exe|dll|so|dylib|bin|dat|db|sqlite)$/i;
        if (binaryExtensions.test(uri.fsPath)) {
          skippedBinaryCount++;
          if ((index + 1) % 50 === 0) {
            this.logger.debug("Progress: Processing files", {
              processed: index + 1,
              total: files.length,
              skipped: skippedBinaryCount,
              matched: matchedCount,
            });
          }
          return null;
        }

        const docStart = Date.now();
        const doc = await workspace.openTextDocument(uri);
        const text = doc.getText();
        const m = combinedPattern.exec(text);
        processedCount++;

        if (m) {
          matchedCount++;
          const pos = doc.positionAt(m.index);
          const line = pos.line + 1;
          const previewLine = doc.lineAt(pos.line).text.trim();
          this.logger.debug("Match found in file", {
            file: this.relativePath(uri),
            line,
            preview: previewLine.substring(0, 50),
          });
          return {
            path: this.relativePath(uri),
            line,
            preview: previewLine,
            reason: "Code reference",
          };
        }

        if ((index + 1) % 50 === 0) {
          this.logger.debug("Progress: Processing files", {
            processed: processedCount,
            total: files.length,
            skipped: skippedBinaryCount,
            matched: matchedCount,
          });
        }

        return null;
      } catch (error: any) {
        errorCount++;
        if (!error.message?.includes("binary")) {
          this.logger.error("Exception in findTextUsages", {
            file: uri.fsPath,
            error: error.message,
          });
        }
        return null;
      }
    });

    this.logger.debug("Starting parallel file processing", { fileCount: files.length });
    const results = await Promise.all(filePromises);
    this.logger.debug("File processing completed", {
      processed: processedCount,
      skipped: skippedBinaryCount,
      matched: matchedCount,
      errors: errorCount,
    });

    const validResults = results.filter(
      (result): result is NonNullable<typeof result> => result !== null,
    );
    const finalResults = validResults.slice(0, FileLimits.maxRelatedResults);
    related.push(...finalResults);

    this.logger.debug("findTextUsages completed", {
      totalDuration: Date.now() - startTime,
      finalResultCount: related.length,
      maxResults: FileLimits.maxRelatedResults,
    });
    return related;
  }

  private async readOverview() {
    const startTime = Date.now();
    this.logger.debug("readOverview started");

    try {
      const findPkgStart = Date.now();
      this.logger.debug("Finding package.json files");
      const pkgUris = await workspace.findFiles(
        FilePatterns.packageJson,
        FilePatterns.excludeWithoutVscode,
        1,
      );
      this.logger.debug("Package.json search completed", {
        duration: Date.now() - findPkgStart,
        found: pkgUris.length > 0,
        path: pkgUris[0]?.fsPath,
      });

      if (!pkgUris.length) {
        this.logger.debug("No package.json found, returning empty overview");
        return "";
      }

      const readDocStart = Date.now();
      this.logger.debug("Reading package.json");
      const doc = await workspace.openTextDocument(pkgUris[0]);
      const json = JSON.parse(doc.getText());
      this.logger.debug("Package.json parsed", {
        duration: Date.now() - readDocStart,
        hasName: !!json.name,
        depCount: Object.keys(json.dependencies || {}).length,
        devDepCount: Object.keys(json.devDependencies || {}).length,
      });

      const name = json.name as string | undefined;
      const deps = json.dependencies
        ? Object.keys(json.dependencies).slice(0, FileLimits.maxDependencies)
        : [];
      const devDeps = json.devDependencies
        ? Object.keys(json.devDependencies).slice(0, FileLimits.maxDevDependencies)
        : [];

      this.logger.debug("Extracted package info", {
        name,
        depCount: deps.length,
        devDepCount: devDeps.length,
        totalDeps: Object.keys(json.dependencies || {}).length,
        totalDevDeps: Object.keys(json.devDependencies || {}).length,
      });

      const parts = [] as string[];
      if (name) parts.push(`${MessageStrings.package}: ${name}`);
      if (deps.length)
        parts.push(
          `${MessageStrings.deps}: ${MessageFormats.dependencies(deps, json.dependencies && Object.keys(json.dependencies).length > deps.length)}`,
        );
      if (devDeps.length)
        parts.push(
          `${MessageStrings.devDeps}: ${MessageFormats.dependencies(devDeps, json.devDependencies && Object.keys(json.devDependencies).length > devDeps.length)}`,
        );

      const overview = MessageFormats.overview(parts);
      this.logger.debug("readOverview completed", {
        totalDuration: Date.now() - startTime,
        overviewLength: overview.length,
        partCount: parts.length,
      });
      return overview;
    } catch (error: any) {
      this.logger.debug("readOverview failed", {
        totalDuration: Date.now() - startTime,
        error: error?.message,
      });
      return "";
    }
  }
}
