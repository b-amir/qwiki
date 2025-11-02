import { workspace, type Disposable, type FileSystemWatcher } from "vscode";
import { ProjectContextCacheService } from "./ProjectContextCacheService";
import { WorkspaceStructureCacheService } from "./WorkspaceStructureCacheService";
import { LoggingService, createLogger, type Logger } from "./LoggingService";
import { DebouncingService, type DebouncedFunction } from "./DebouncingService";
import { ServiceLimits } from "../../constants/ServiceLimits";

export class ProjectContextCacheInvalidationService {
  private logger: Logger;
  private fileWatcher: FileSystemWatcher | null = null;
  private disposables: Disposable[] = [];
  private debouncedInvalidate: DebouncedFunction<(uri: string) => Promise<void>> | null = null;

  constructor(
    private cacheService: ProjectContextCacheService,
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private loggingService: LoggingService,
    private debouncingService: DebouncingService,
  ) {
    this.logger = createLogger("ProjectContextCacheInvalidationService", loggingService);
  }

  startWatching(): void {
    if (this.fileWatcher) {
      this.logger.debug("File watcher already started");
      return;
    }

    this.logger.info("Starting file watcher for cache invalidation");

    this.debouncedInvalidate = this.debouncingService.debounce(
      async (uri: string) => {
        await this.invalidateCacheForFile(uri);
      },
      ServiceLimits.projectContextCacheInvalidationDebounce,
      { leading: false, trailing: true },
    );

    this.fileWatcher = workspace.createFileSystemWatcher("**/*");
    this.fileWatcher.onDidCreate((uri) => {
      this.logger.debug("File created", { path: uri.fsPath });
      if (this.shouldInvalidate(uri.fsPath)) {
        if (this.debouncedInvalidate) {
          this.debouncedInvalidate(uri.fsPath);
        }
      }
    });

    this.fileWatcher.onDidChange((uri) => {
      if (this.shouldInvalidate(uri.fsPath)) {
        if (this.debouncedInvalidate) {
          this.debouncedInvalidate(uri.fsPath);
        }
      }
    });

    this.fileWatcher.onDidDelete((uri) => {
      this.logger.debug("File deleted", { path: uri.fsPath });
      if (this.shouldInvalidate(uri.fsPath)) {
        this.invalidateCacheForFile(uri.fsPath);
      }
    });

    this.disposables.push(this.fileWatcher);
  }

  private shouldInvalidate(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    const keyFiles = [
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "tsconfig.json",
      "jsconfig.json",
      "webpack.config",
      "vite.config",
      "rollup.config",
      ".gitignore",
      "README.md",
    ];

    for (const keyFile of keyFiles) {
      if (lowerPath.endsWith(keyFile.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private async invalidateCacheForFile(filePath: string): Promise<void> {
    try {
      this.logger.debug("Invalidating cache for file change", { filePath });

      const workspaceFolders = workspace.workspaceFolders;
      const workspaceRoot =
        workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : "";

      if (this.shouldInvalidateWorkspaceStructure(filePath)) {
        if (workspaceRoot) {
          await this.workspaceStructureCache.clear(workspaceRoot);
          this.logger.info("Invalidated workspace structure cache", { filePath });
        }
      }

      // Invalidate dependency map for the changed file
      await this.workspaceStructureCache.deleteDependencyMap(filePath);

      // Note: File relevance scores are cached per target file, so they'll be
      // invalidated based on TTL. If needed, we could track all cached target files
      // and invalidate their relevance scores when dependencies change.

      const allKeys = await this.cacheService.getAllKeys();
      const keysToInvalidate: string[] = [];

      for (const key of allKeys) {
        const metadata = await this.cacheService.getMetadata(key);
        if (metadata && metadata.packageJsonPath === filePath) {
          keysToInvalidate.push(key);
        }
      }

      if (keysToInvalidate.length > 0) {
        for (const key of keysToInvalidate) {
          await this.cacheService.delete(key);
        }
        this.logger.info("Invalidated cache entries", {
          count: keysToInvalidate.length,
          filePath,
        });
      } else {
        this.logger.debug("No cache entries to invalidate", { filePath });
      }
    } catch (error) {
      this.logger.error("Error invalidating cache", { filePath, error });
    }
  }

  private shouldInvalidateWorkspaceStructure(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    const structureFiles = [
      "package.json",
      "tsconfig.json",
      "jsconfig.json",
      "webpack.config",
      "vite.config",
      "rollup.config",
    ];
    return structureFiles.some((file) => lowerPath.endsWith(file.toLowerCase()));
  }

  async invalidateAll(): Promise<void> {
    try {
      this.logger.info("Invalidating all cache entries");
      await this.cacheService.clear();
    } catch (error) {
      this.logger.error("Error clearing cache", { error });
    }
  }

  dispose(): void {
    this.logger.debug("Disposing ProjectContextCacheInvalidationService");
    if (this.debouncedInvalidate) {
      this.debouncedInvalidate.cancel();
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.fileWatcher = null;
    this.debouncedInvalidate = null;
  }
}
