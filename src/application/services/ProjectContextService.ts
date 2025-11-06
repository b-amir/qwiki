import { Uri, Webview, workspace } from "vscode";
import { OutboundEvents, LoadingSteps } from "../../constants";
import { FileLimits, PathPatterns } from "../../constants";
import type { Selection, ProjectContext } from "../../domain/entities/Selection";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { ProjectIndexService } from "../../infrastructure/services/ProjectIndexService";
import { WorkspaceStructureCacheService } from "../../infrastructure/services/WorkspaceStructureCacheService";
import { TextUsageSearchService } from "./context/TextUsageSearchService";
import { ProjectOverviewService } from "./context/ProjectOverviewService";

export class ProjectContextService {
  private logger: Logger;

  constructor(
    private loggingService: LoggingService,
    private projectIndexService: ProjectIndexService,
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private textUsageSearchService: TextUsageSearchService,
    private projectOverviewService: ProjectOverviewService,
  ) {
    this.logger = createLogger("ProjectContextService");
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
    const workspaceRoot = folders && folders.length > 0 ? folders[0].uri.fsPath : "";
    const rootName = folders && folders.length ? folders[0].name : "";
    this.logger.debug("Workspace folders retrieved", {
      duration: Date.now() - foldersStart,
      rootName,
      folderCount: folders?.length || 0,
    });

    let overview: string;
    let filesSample: string[];

    const structureCacheStart = Date.now();
    const cachedStructure = workspaceRoot
      ? await this.workspaceStructureCache.getWorkspaceStructure(workspaceRoot)
      : null;

    if (cachedStructure) {
      this.logger.debug("Using cached workspace structure", {
        duration: Date.now() - structureCacheStart,
        rootName: cachedStructure.rootName,
        fileCount: cachedStructure.filesSample.length,
      });
      overview = cachedStructure.overview;
      filesSample = cachedStructure.filesSample;
    } else {
      const findFilesStart = Date.now();
      this.logger.debug("Getting indexed files");
      const indexedFiles = await this.projectIndexService.getIndexedFiles();
      const files = indexedFiles.slice(0, FileLimits.projectFiles).map((f) => f.uri);
      this.logger.debug("Indexed files retrieved", {
        duration: Date.now() - findFilesStart,
        fileCount: files.length,
      });

      const filesSampleStart = Date.now();
      filesSample = files.slice(0, FileLimits.maxFileSample).map(this.relativePath);
      this.logger.debug("Files sample created", {
        duration: Date.now() - filesSampleStart,
        sampleCount: filesSample.length,
      });

      const overviewStart = Date.now();
      this.logger.debug("Reading project overview");
      overview = await this.projectOverviewService.readOverview();
      this.logger.debug("Project overview read", {
        duration: Date.now() - overviewStart,
        overviewLength: overview?.length || 0,
      });

      if (workspaceRoot) {
        await this.workspaceStructureCache.setWorkspaceStructure(workspaceRoot, {
          rootName,
          overview,
          filesSample,
        });
        this.logger.debug("Cached workspace structure", {
          rootName,
          fileCount: filesSample.length,
        });
      }
    }

    if (webview) {
      this.logger.debug("Sending loading step to webview", {
        step: LoadingSteps.buildingContextSummary,
      });
      webview.postMessage({
        command: OutboundEvents.loadingStep,
        payload: { step: LoadingSteps.buildingContextSummary },
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
      related = await this.textUsageSearchService.findTextUsages(
        token,
        this.relativePath.bind(this),
      );
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
}
