import { workspace, Uri, FileSystemWatcher, type Disposable } from "vscode";
import { ServiceLimits, FilePatterns } from "@/constants";
import type {
  DebouncingService,
  DebouncedFunction,
} from "@/infrastructure/services/optimization/DebouncingService";
import type {
  GitChangeDetectionService,
  ChangedFile,
} from "@/infrastructure/services/integration/GitChangeDetectionService";
import type { Logger } from "@/infrastructure/services";
import type { IndexCacheService } from "@/infrastructure/services/indexing/IndexCacheService";

export class FileWatcherManager {
  private fileWatcher: FileSystemWatcher | null = null;
  private debouncedUpdate: DebouncedFunction<(uri: Uri) => Promise<void>> | null = null;
  private disposables: Disposable[] = [];
  private gitUnsubscribe: (() => void) | null = null;
  private watchersActive = false;
  private gitStatusCache = new Map<string, { isTracked: boolean; lastChecked: number }>();
  private readonly GIT_STATUS_CACHE_TTL = 5000;

  constructor(
    private debouncingService: DebouncingService,
    private cacheService: IndexCacheService,
    private logger: Logger,
    private indexFile: (uri: Uri) => Promise<void>,
    private updateFileIndex: (uri: Uri) => Promise<void>,
    private removeFromIndex: (uri: Uri) => void,
    private gitChangeDetectionService?: GitChangeDetectionService,
  ) {}

  setupFileWatchers(): void {
    if (this.fileWatcher) {
      this.logger.debug("File watchers already set up");
      return;
    }

    const pattern = this.getOptimizedPattern();
    this.fileWatcher = workspace.createFileSystemWatcher(pattern);
    this.debouncedUpdate = this.debouncingService.debounce(
      (uri: Uri) => this.updateFileIndex(uri),
      ServiceLimits.indexDebounceDelay,
      { leading: false, trailing: true },
    );

    const debouncedCreate = this.debouncingService.debounce(
      async (uri: Uri) => {
        if (await this.shouldProcessFile(uri)) {
          this.logger.debug("File created", { path: uri.fsPath });
          await this.indexFile(uri);
        }
      },
      ServiceLimits.indexDebounceDelay,
      { leading: false, trailing: true },
    );

    const debouncedDelete = this.debouncingService.debounce(
      (uri: Uri) => {
        this.logger.debug("File deleted", { path: uri.fsPath });
        this.removeFromIndex(uri);
      },
      ServiceLimits.indexDebounceDelay,
      { leading: false, trailing: true },
    );

    this.fileWatcher.onDidCreate((uri) => {
      debouncedCreate(uri);
    });

    this.fileWatcher.onDidChange(async (uri) => {
      if (await this.shouldProcessFile(uri)) {
        if (this.debouncedUpdate) {
          this.debouncedUpdate(uri);
        }
      }
    });

    this.fileWatcher.onDidDelete((uri) => {
      debouncedDelete(uri);
    });

    this.disposables.push(this.fileWatcher);
    this.watchersActive = true;
    this.logger.debug("File watchers set up with optimized pattern", { pattern });
  }

  private getOptimizedPattern(): string {
    return FilePatterns.sourceFiles;
  }

  private async shouldProcessFile(uri: Uri): Promise<boolean> {
    const filePath = uri.fsPath.toLowerCase();

    const excludePatterns = [
      "node_modules",
      "dist",
      "out",
      "build",
      ".git",
      ".vscode",
      "_refs",
      "tmp",
      "temp",
    ];

    for (const pattern of excludePatterns) {
      if (filePath.includes(pattern)) {
        return false;
      }
    }

    if (this.gitChangeDetectionService) {
      const isTracked = await this.isFileTracked(uri);
      if (isTracked) {
        return true;
      }
    }

    return true;
  }

  private async isFileTracked(uri: Uri): Promise<boolean> {
    if (!this.gitChangeDetectionService) {
      return false;
    }

    const cacheKey = uri.fsPath;
    const cached = this.gitStatusCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.lastChecked < this.GIT_STATUS_CACHE_TTL) {
      return cached.isTracked;
    }

    try {
      const isTracked = await this.gitChangeDetectionService.isFileChanged(uri);
      this.gitStatusCache.set(cacheKey, { isTracked, lastChecked: now });
      return isTracked;
    } catch (error) {
      this.logger.debug("Failed to check if file is tracked", { path: uri.fsPath, error });
      return false;
    }
  }

  activateWatchers(): void {
    if (this.watchersActive) {
      return;
    }

    if (!this.fileWatcher) {
      this.setupFileWatchers();
    }
    this.watchersActive = true;
    this.logger.debug("File watchers activated");
  }

  deactivateWatchers(): void {
    if (!this.watchersActive) {
      return;
    }

    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }
    this.watchersActive = false;
    this.logger.debug("File watchers deactivated");
  }

  setupGitBasedWatchers(): void {
    if (!this.gitChangeDetectionService) {
      this.logger.debug("Git change detection service not available, using FileSystemWatcher only");
      return;
    }

    this.gitUnsubscribe = this.gitChangeDetectionService.subscribeToChanges(
      async (changedFiles: ChangedFile[]) => {
        if (changedFiles.length === 0) {
          return;
        }

        const processedFiles = new Set<string>();

        for (const changedFile of changedFiles) {
          const filePath = changedFile.uri.fsPath;
          if (processedFiles.has(filePath)) {
            continue;
          }
          processedFiles.add(filePath);

          if (changedFile.status === "deleted") {
            this.removeFromIndex(changedFile.uri);
            this.gitStatusCache.delete(filePath);
          } else if (changedFile.status === "added" || changedFile.status === "modified") {
            if (this.debouncedUpdate) {
              this.debouncedUpdate(changedFile.uri);
            }
            this.gitStatusCache.set(filePath, {
              isTracked: true,
              lastChecked: Date.now(),
            });
          }
        }

        if (processedFiles.size > 0) {
          await this.cacheService.persistIndex();
        }
      },
    );

    this.logger.info("Git-based file watchers initialized", {
      usingGitWatchers: true,
    });
  }

  dispose(): void {
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
  }

  getDebouncedUpdate(): DebouncedFunction<(uri: Uri) => Promise<void>> | null {
    return this.debouncedUpdate;
  }
}
