import { workspace, Uri, type ExtensionContext, type Disposable } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { DebouncingService } from "@/infrastructure/services/optimization/DebouncingService";
import { GitChangeDetectionService } from "@/infrastructure/services/integration/GitChangeDetectionService";
import type { Disposable as IDisposable } from "vscode";
import { FileMetadataExtractionService } from "@/infrastructure/services/indexing/FileMetadataExtractionService";
import { IndexCacheService } from "@/infrastructure/services/indexing/IndexCacheService";
import {
  IndexInitializer,
  type QuickInitResult,
} from "@/infrastructure/services/indexing/initialization/IndexInitializer";
import { FileIndexer } from "@/infrastructure/services/indexing/indexing/FileIndexer";
import { FileWatcherManager } from "@/infrastructure/services/indexing/watchers/FileWatcherManager";
import { IndexingExclusionService } from "@/infrastructure/services/indexing/IndexingExclusionService";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import type { TaskSchedulerService } from "@/infrastructure/services/orchestration/TaskSchedulerService";

export interface IndexedFile {
  uri: Uri;
  path: string;
  language?: string;
  size: number;
  modifiedTime: number;
  isSourceFile: boolean;
  metadata?: {
    imports?: string[];
  };
}

export interface ProjectIndexCache {
  version: number;
  indexedAt: number;
  files: Array<[string, IndexedFile]>;
  languageIndex: Array<[string, string[]]>;
}

export interface SymbolInfo {
  name: string;
  location: Uri;
}

export class ProjectIndexService {
  private logger: Logger;
  private disposables: IDisposable[] = [];
  private isInitialized = false;
  private quickIndexComplete = false;
  private quickInitPromise: Promise<QuickInitResult> | null = null;
  private initPromise: Promise<void> | null = null;
  private metadataExtractor: FileMetadataExtractionService;
  private cacheService: IndexCacheService;
  private indexInitializer: IndexInitializer;
  private fileIndexer: FileIndexer;
  private fileWatcherManager: FileWatcherManager;
  private exclusionService: IndexingExclusionService;

  constructor(
    private extensionContext: ExtensionContext,
    private loggingService: LoggingService,
    private debouncingService: DebouncingService,
    gitChangeDetectionService?: GitChangeDetectionService,
    taskScheduler?: TaskSchedulerService,
  ) {
    this.logger = createLogger("ProjectIndexService");
    this.metadataExtractor = new FileMetadataExtractionService(loggingService);
    this.cacheService = new IndexCacheService(extensionContext, loggingService);
    this.indexInitializer = new IndexInitializer(this.cacheService, this.logger);

    const fileSystemService = new VSCodeFileSystemService(loggingService);
    this.exclusionService = new IndexingExclusionService(loggingService, fileSystemService);

    this.fileIndexer = new FileIndexer(
      this.metadataExtractor,
      this.cacheService,
      this.logger,
      taskScheduler,
      this.exclusionService,
    );
    this.fileWatcherManager = new FileWatcherManager(
      this.debouncingService,
      this.cacheService,
      this.logger,
      (uri) => this.fileIndexer.indexFile(uri),
      (uri) => this.fileIndexer.updateFileIndex(uri),
      (uri) => this.fileIndexer.removeFromIndex(uri),
      gitChangeDetectionService,
    );
  }

  async quickInit(): Promise<void> {
    if (this.quickIndexComplete) {
      this.logger.debug("Quick index already complete");
      return;
    }

    if (this.quickInitPromise) {
      this.logger.debug("Quick init already in progress, waiting");
      await this.quickInitPromise;
      return;
    }

    this.quickInitPromise = this.indexInitializer.quickInit();
    const result = await this.quickInitPromise;
    this.quickIndexComplete = result.success || result.cacheStatus !== "expired";

    if (result.needsBackgroundRefresh && !this.isInitialized) {
      this.scheduleBackgroundRefresh();
    }
  }

  private scheduleBackgroundRefresh(): void {
    setImmediate(() => {
      this.initialize().catch((error) => {
        this.logger.error("Background refresh failed", error);
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug("ProjectIndexService already initialized");
      return;
    }

    if (this.initPromise) {
      this.logger.debug("ProjectIndexService initialization in progress, waiting");
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();

    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  private async doInitialize(): Promise<void> {
    this.logger.info("Initializing ProjectIndexService (full scan)");
    const startTime = Date.now();

    try {
      if (!this.quickIndexComplete) {
        await this.quickInit();
      }

      await this.fileIndexer.performInitialIndex();
      this.fileWatcherManager.setupFileWatchers();
      this.fileWatcherManager.setupGitBasedWatchers();
      this.isInitialized = true;

      this.schedulePeriodicCleanup();

      const duration = Date.now() - startTime;
      this.logger.info("ProjectIndexService fully initialized", {
        duration,
        fileCount: this.cacheService.getIndex().size,
        languageCount: this.cacheService.getLanguageIndex().size,
      });
    } catch (error) {
      this.logger.error("Failed to initialize ProjectIndexService", error);
      throw error;
    }
  }

  /**
   * Check if quick index is available (for immediate use)
   */
  isQuickIndexReady(): boolean {
    return this.quickIndexComplete;
  }

  async getIndexedFiles(): Promise<IndexedFile[]> {
    // Use quick index if available, otherwise wait for full init
    if (!this.quickIndexComplete && !this.isInitialized) {
      await this.quickInit();
    }
    return Array.from(this.cacheService.getIndex().values());
  }

  async getFilesByLanguage(language: string): Promise<IndexedFile[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    const filePaths = this.cacheService.getLanguageIndex().get(language);
    if (!filePaths) return [];
    const index = this.cacheService.getIndex();
    return Array.from(filePaths)
      .map((path) => index.get(path))
      .filter((file): file is IndexedFile => file !== undefined);
  }

  async getSymbolsForFile(_fileUri: Uri): Promise<SymbolInfo[]> {
    return [];
  }

  async searchSymbols(_query: string, _maxResults?: number): Promise<SymbolInfo[]> {
    return [];
  }

  isIndexed(filePath: string): boolean {
    return this.cacheService.getIndex().has(filePath);
  }

  invalidateCache(filePath?: string): void {
    const index = this.cacheService.getIndex();
    if (filePath) {
      index.delete(filePath);
      this.cacheService.updateLanguageIndexForFile(filePath, undefined);
      this.logger.debug("Invalidated cache for file", { filePath });
    } else {
      index.clear();
      this.cacheService.getLanguageIndex().clear();
      this.logger.debug("Invalidated entire cache");
    }
  }

  getIndexCacheService(): IndexCacheService {
    return this.cacheService;
  }

  private schedulePeriodicCleanup(): void {
    const CLEANUP_INTERVAL = 30 * 60 * 1000;

    const intervalId = setInterval(async () => {
      try {
        const result = await this.cacheService.removeStaleEntries();
        if (result.removed > 0) {
          this.logger.info(`Periodic cleanup removed ${result.removed} stale entries`);
        }
      } catch (error) {
        this.logger.warn("Periodic cleanup failed", error);
      }
    }, CLEANUP_INTERVAL);

    this.disposables.push({ dispose: () => clearInterval(intervalId) });
  }

  dispose(): void {
    this.logger.debug("Disposing ProjectIndexService");
    this.fileWatcherManager.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.isInitialized = false;
  }
}
