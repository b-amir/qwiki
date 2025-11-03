import { workspace, Uri, type ExtensionContext, type Disposable, FileSystemWatcher } from "vscode";
import { LoggingService, createLogger, type Logger } from "./LoggingService";
import { DebouncingService, type DebouncedFunction } from "./DebouncingService";
import { GitChangeDetectionService } from "./GitChangeDetectionService";
import { ServiceLimits } from "../../constants/ServiceLimits";
import { FilePatterns } from "../../constants/FilePatterns";
import type { Disposable as IDisposable } from "vscode";
import { FileMetadataExtractionService } from "./indexing/FileMetadataExtractionService";
import { IndexCacheService } from "./indexing/IndexCacheService";

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
  private fileWatcher: FileSystemWatcher | null = null;
  private debouncedUpdate: DebouncedFunction<(uri: Uri) => Promise<void>> | null = null;
  private disposables: IDisposable[] = [];
  private isInitialized = false;
  private binaryPatterns: RegExp[];
  private metadataExtractor: FileMetadataExtractionService;
  private cacheService: IndexCacheService;
  private gitChangeDetectionService: GitChangeDetectionService | null = null;
  private gitUnsubscribe: (() => void) | null = null;

  constructor(
    private extensionContext: ExtensionContext,
    private loggingService: LoggingService,
    private debouncingService: DebouncingService,
    gitChangeDetectionService?: GitChangeDetectionService,
  ) {
    this.logger = createLogger("ProjectIndexService", loggingService);
    this.metadataExtractor = new FileMetadataExtractionService(loggingService);
    this.cacheService = new IndexCacheService(extensionContext, loggingService);
    this.gitChangeDetectionService = gitChangeDetectionService || null;
    this.binaryPatterns = [
      FilePatterns.excludeBinary,
      FilePatterns.excludeLarge,
      FilePatterns.excludeBackups,
    ].map((pattern) => new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")));
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug("ProjectIndexService already initialized");
      return;
    }

    this.logger.info("Initializing ProjectIndexService");
    const startTime = Date.now();

    try {
      const cached = await this.cacheService.loadIndexFromCache();
      if (cached) {
        this.logger.info("Loaded index from cache", {
          fileCount: cached.files.length,
          ageMinutes: Math.round((Date.now() - cached.indexedAt) / 60000),
        });
        this.cacheService.restoreCache(cached);
      } else {
        this.logger.debug("No valid cache found, starting fresh index");
      }

      await this.performInitialIndex();
      this.setupFileWatchers();
      this.setupGitBasedWatchers();
      this.isInitialized = true;

      const duration = Date.now() - startTime;
      this.logger.info("ProjectIndexService initialized successfully", {
        duration,
        fileCount: this.cacheService.getIndex().size,
        languageCount: this.cacheService.getLanguageIndex().size,
      });
    } catch (error) {
      this.logger.error("Failed to initialize ProjectIndexService", error);
      throw error;
    }
  }

  async getIndexedFiles(): Promise<IndexedFile[]> {
    if (!this.isInitialized) {
      await this.initialize();
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

  dispose(): void {
    this.logger.debug("Disposing ProjectIndexService");
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    if (this.debouncedUpdate) {
      this.debouncedUpdate.cancel();
    }
    if (this.gitUnsubscribe) {
      this.gitUnsubscribe();
      this.gitUnsubscribe = null;
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.isInitialized = false;
  }

  private async performInitialIndex(): Promise<void> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.logger.warn("No workspace folders found for indexing");
      return;
    }

    this.logger.debug("Starting initial index", { folderCount: workspaceFolders.length });

    try {
      const files = await workspace.findFiles(FilePatterns.allFiles, FilePatterns.exclude);

      this.logger.debug("Found files for indexing", { fileCount: files.length });

      const batchSize = ServiceLimits.indexBatchSize;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        await Promise.all(batch.map((uri) => this.indexFile(uri)));

        if (i % (batchSize * 5) === 0) {
          this.logger.debug("Indexing progress", {
            processed: Math.min(i + batchSize, files.length),
            total: files.length,
          });
        }
      }

      await this.cacheService.persistIndex();
      this.logger.info("Initial index completed", { fileCount: this.cacheService.getIndex().size });
    } catch (error) {
      this.logger.error("Failed during initial index", error);
      throw error;
    }
  }

  private setupFileWatchers(): void {
    this.fileWatcher = workspace.createFileSystemWatcher("**/*");
    this.debouncedUpdate = this.debouncingService.debounce(
      (uri: Uri) => this.updateFileIndex(uri),
      ServiceLimits.indexDebounceDelay,
      { leading: false, trailing: true },
    );

    this.fileWatcher.onDidCreate(async (uri) => {
      this.logger.debug("File created", { path: uri.fsPath });
      await this.indexFile(uri);
    });

    this.fileWatcher.onDidChange(async (uri) => {
      if (this.debouncedUpdate) {
        this.debouncedUpdate(uri);
      }
    });

    this.fileWatcher.onDidDelete((uri) => {
      this.logger.debug("File deleted", { path: uri.fsPath });
      this.removeFromIndex(uri);
    });

    this.disposables.push(this.fileWatcher);
  }

  private setupGitBasedWatchers(): void {
    if (!this.gitChangeDetectionService) {
      this.logger.debug("Git change detection service not available, using FileSystemWatcher only");
      return;
    }

    this.gitUnsubscribe = this.gitChangeDetectionService.subscribeToChanges(
      async (changedFiles) => {
        for (const changedFile of changedFiles) {
          if (changedFile.status === "deleted") {
            this.removeFromIndex(changedFile.uri);
          } else if (changedFile.status === "added" || changedFile.status === "modified") {
            if (this.debouncedUpdate) {
              this.debouncedUpdate(changedFile.uri);
            }
          }
        }

        if (changedFiles.length > 0) {
          await this.cacheService.persistIndex();
        }
      },
    );

    this.logger.info("Git-based file watchers initialized", {
      usingGitWatchers: true,
    });
  }

  private async indexFile(uri: Uri): Promise<void> {
    try {
      const stat = await workspace.fs.stat(uri);
      if (!this.shouldIndexFile(uri.fsPath, stat.size)) {
        return;
      }

      const indexedFile = await this.metadataExtractor.extractFileMetadata(uri, stat.size);
      this.cacheService.getIndex().set(uri.fsPath, indexedFile);
      this.cacheService.updateLanguageIndexForFile(uri.fsPath, indexedFile.language);

      this.logger.debug("Indexed file", {
        path: uri.fsPath,
        language: indexedFile.language,
        importCount: indexedFile.metadata?.imports?.length || 0,
      });
    } catch (error) {
      this.logger.debug(`Failed to index file ${uri.fsPath}`, error);
    }
  }

  private async updateFileIndex(uri: Uri): Promise<void> {
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

  private removeFromIndex(uri: Uri): void {
    this.cacheService.getIndex().delete(uri.fsPath);
    this.cacheService.updateLanguageIndexForFile(uri.fsPath, undefined);
  }

  private shouldIndexFile(filePath: string, size: number): boolean {
    if (size > ServiceLimits.maxIndexFileSize) {
      return false;
    }

    for (const pattern of this.binaryPatterns) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    return true;
  }
}
