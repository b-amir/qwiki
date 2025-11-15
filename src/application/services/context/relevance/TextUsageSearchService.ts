import { workspace, type Uri } from "vscode";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { FilePatterns, FileLimits } from "@/constants";
import { PathPatterns } from "@/constants";

export class TextUsageSearchService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("TextUsageSearchService");
  }

  async findTextUsages(
    token: string,
    relativePathFn: (uri: Uri) => string,
  ): Promise<Array<{ path: string; preview?: string; line?: number; reason?: string }>> {
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
          return {
            path: relativePathFn(uri),
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
}
