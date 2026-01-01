import { workspace, Uri, commands } from "vscode";
import { ServiceLimits } from "@/constants";
import { FilePatterns } from "@/constants";
import type { Logger } from "@/infrastructure/services";
import type { FileMetadataExtractionService } from "@/infrastructure/services/indexing/FileMetadataExtractionService";
import type { IndexCacheService } from "@/infrastructure/services/indexing/IndexCacheService";
import type { IndexingExclusionService } from "@/infrastructure/services/indexing/IndexingExclusionService";
import type { IndexedFile } from "@/infrastructure/services/indexing/ProjectIndexService";
import type { DocumentSymbol } from "vscode";
import type { TaskSchedulerService } from "@/infrastructure/services/orchestration/TaskSchedulerService";
import { TaskPriority } from "@/infrastructure/services/orchestration/TaskSchedulerService";

export class FileIndexer {
  private binaryPatterns: RegExp[];
  private filesPendingSymbolPrefetch: Uri[] = [];

  constructor(
    private metadataExtractor: FileMetadataExtractionService,
    private cacheService: IndexCacheService,
    private logger: Logger,
    private taskScheduler?: TaskSchedulerService,
    private exclusionService?: IndexingExclusionService,
  ) {
    this.binaryPatterns = [
      FilePatterns.excludeBinary,
      FilePatterns.excludeLarge,
      FilePatterns.excludeBackups,
    ].map((pattern) => new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")));
  }

  async performInitialIndex(): Promise<void> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.logger.warn("No workspace folders found for indexing");
      return;
    }

    this.logger.debug("Starting initial index", { folderCount: workspaceFolders.length });

    try {
      if (this.exclusionService) {
        await this.exclusionService.initialize();
        const stats = this.exclusionService.getPatternStats();
        this.logger.info("Exclusion service initialized", stats);
      }

      const exclusionPattern = this.buildExclusionPattern();
      const files = await workspace.findFiles(FilePatterns.allFiles, exclusionPattern);

      const filteredFiles = this.exclusionService
        ? files.filter((uri) => !this.exclusionService!.shouldExclude(uri.fsPath))
        : files;

      this.logger.info("Found files for indexing", {
        rawCount: files.length,
        filteredCount: filteredFiles.length,
        excludedByService: files.length - filteredFiles.length,
      });

      this.filesPendingSymbolPrefetch = [];

      const batchSize = ServiceLimits.indexBatchSize;
      for (let i = 0; i < filteredFiles.length; i += batchSize) {
        const batch = filteredFiles.slice(i, i + batchSize);
        await Promise.all(batch.map((uri) => this.indexFile(uri, false)));

        if (i % (batchSize * 5) === 0) {
          this.logger.debug("Indexing progress", {
            processed: Math.min(i + batchSize, filteredFiles.length),
            total: filteredFiles.length,
          });
        }
      }

      await this.cacheService.persistIndex();
      this.logger.info("Initial index completed", { fileCount: this.cacheService.getIndex().size });

      this.scheduleBackgroundSymbolPrefetch();
    } catch (error) {
      this.logger.error("Failed during initial index", error);
      throw error;
    }
  }

  private buildExclusionPattern(): string {
    const dirPatterns = FilePatterns.excludeDirectories.filter((p) => !p.includes("*")).join(",");

    return `**/{${dirPatterns}}/**`;
  }

  async indexFile(uri: Uri, prefetchSymbols = true): Promise<void> {
    try {
      const stat = await workspace.fs.stat(uri);
      if (!this.shouldIndexFile(uri.fsPath, stat.size)) {
        return;
      }

      const indexedFile = await this.metadataExtractor.extractFileMetadata(uri, stat.size);
      this.cacheService.getIndex().set(uri.fsPath, indexedFile);
      this.cacheService.updateLanguageIndexForFile(uri.fsPath, indexedFile.language);

      if (prefetchSymbols) {
        await this.prefetchSymbols(uri);
      } else {
        this.filesPendingSymbolPrefetch.push(uri);
      }
    } catch (error) {
      this.logger.debug(`Failed to index file ${uri.fsPath}`, error);
    }
  }

  private scheduleBackgroundSymbolPrefetch(): void {
    if (this.filesPendingSymbolPrefetch.length === 0) {
      return;
    }

    if (!this.taskScheduler) {
      this.logger.debug("TaskScheduler not available, skipping background symbol prefetch");
      return;
    }

    const filesToPrefetch = [...this.filesPendingSymbolPrefetch];
    this.filesPendingSymbolPrefetch = [];

    this.logger.debug("Scheduling background symbol prefetch", {
      fileCount: filesToPrefetch.length,
    });

    const BATCH_SIZE = 10;
    for (let i = 0; i < filesToPrefetch.length; i += BATCH_SIZE) {
      const batch = filesToPrefetch.slice(i, i + BATCH_SIZE);
      this.taskScheduler.schedule({
        id: `prefetch-symbols-batch-${i}`,
        priority: TaskPriority.LOW,
        execute: async () => {
          for (const uri of batch) {
            await this.prefetchSymbols(uri);
          }
        },
        estimatedDuration: 100 * batch.length,
      });
    }
  }

  private async prefetchSymbols(uri: Uri): Promise<void> {
    try {
      const cachedSymbols = await this.cacheService.getSymbols(uri.fsPath);
      if (cachedSymbols) {
        return;
      }

      const symbols = await commands.executeCommand<Array<DocumentSymbol>>(
        "vscode.executeDocumentSymbolProvider",
        uri,
      );

      if (symbols && symbols.length > 0) {
        await this.cacheService.setSymbols(uri.fsPath, symbols);
        this.logger.debug("Symbols pre-fetched during indexing", {
          filePath: uri.fsPath,
          symbolCount: symbols.length,
        });
      }
    } catch (error) {
      this.logger.debug(`Failed to pre-fetch symbols for ${uri.fsPath}`, error);
    }
  }

  async updateFileIndex(uri: Uri): Promise<void> {
    try {
      const stat = await workspace.fs.stat(uri);
      if (!this.shouldIndexFile(uri.fsPath, stat.size)) {
        this.removeFromIndex(uri);
        return;
      }

      await this.indexFile(uri);
      await this.cacheService.persistIndex();
    } catch (error) {
      this.logger.debug(`Failed to update file index ${uri.fsPath}`, error);
    }
  }

  removeFromIndex(uri: Uri): void {
    this.cacheService.getIndex().delete(uri.fsPath);
    this.cacheService.updateLanguageIndexForFile(uri.fsPath, undefined);
  }

  shouldIndexFile(filePath: string, size: number): boolean {
    if (size > ServiceLimits.maxIndexFileSize) {
      return false;
    }

    for (const pattern of this.binaryPatterns) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    if (this.exclusionService?.shouldExclude(filePath)) {
      return false;
    }

    return true;
  }
}
