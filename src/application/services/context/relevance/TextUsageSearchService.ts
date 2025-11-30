import { workspace, type Uri } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
  CachingService,
} from "@/infrastructure/services";
import { ProjectIndexService } from "@/infrastructure/services/indexing/ProjectIndexService";
import { FilePatterns, FileLimits, ServiceLimits } from "@/constants";
import { PathPatterns } from "@/constants";

export class TextUsageSearchService {
  private logger: Logger;
  private readonly CONCURRENCY_LIMIT = 15;

  constructor(
    private loggingService: LoggingService,
    private cachingService: CachingService,
    private projectIndexService: ProjectIndexService,
  ) {
    this.logger = createLogger("TextUsageSearchService");
  }

  async findTextUsages(
    token: string,
    relativePathFn: (uri: Uri) => string,
  ): Promise<Array<{ path: string; preview?: string; line?: number; reason?: string }>> {
    const startTime = Date.now();
    this.logger.debug("findTextUsages started", { token });

    const projectStateHash = await this.getProjectStateHash();
    const cacheKey = this.generateCacheKey(token, projectStateHash);
    const cachedResult =
      await this.cachingService.get<
        Array<{ path: string; preview?: string; line?: number; reason?: string }>
      >(cacheKey);

    if (cachedResult) {
      this.logger.debug("Text usage search cache hit", { token, resultCount: cachedResult.length });
      return cachedResult;
    }

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
    const results: Array<{
      path: string;
      preview?: string;
      line?: number;
      reason?: string;
    } | null> = [];

    const processFile = async (uri: Uri, index: number): Promise<(typeof results)[number]> => {
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

        const fileData = await workspace.fs.readFile(uri);
        const text = Buffer.from(fileData).toString("utf-8");
        const m = combinedPattern.exec(text);
        processedCount++;

        if (m) {
          matchedCount++;
          const matchIndex = m.index;
          const lines = text.substring(0, matchIndex).split("\n");
          const line = lines.length;
          const previewLine = lines[lines.length - 1]?.trim() || "";
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
    };

    this.logger.debug("Starting batched file processing", {
      fileCount: files.length,
      concurrencyLimit: this.CONCURRENCY_LIMIT,
    });

    for (let i = 0; i < files.length; i += this.CONCURRENCY_LIMIT) {
      const batch = files.slice(i, i + this.CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map((uri, batchIndex) => processFile(uri, i + batchIndex)),
      );
      results.push(...batchResults);
    }

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

    await this.cachingService.set(cacheKey, related, {
      ttl: ServiceLimits.cacheDefaultTTL,
    });

    this.logger.debug("findTextUsages completed", {
      totalDuration: Date.now() - startTime,
      finalResultCount: related.length,
      maxResults: FileLimits.maxRelatedResults,
    });
    return related;
  }

  private generateCacheKey(token: string, projectStateHash: string): string {
    return `textUsageSearch:${token}:${projectStateHash}`;
  }

  private async getProjectStateHash(): Promise<string> {
    const indexedFiles = await this.projectIndexService.getIndexedFiles();
    const filePaths = indexedFiles
      .map((f) => f.uri.fsPath)
      .sort()
      .join("|");
    return this.simpleHash(filePaths);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
