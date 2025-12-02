import { workspace, type Disposable, type FileSystemWatcher } from "vscode";
import { ProjectContextCacheService } from "@/infrastructure/services/caching/ProjectContextCacheService";
import { WorkspaceStructureCacheService } from "@/infrastructure/services/caching/WorkspaceStructureCacheService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import {
  DebouncingService,
  type DebouncedFunction,
} from "@/infrastructure/services/optimization/DebouncingService";
import { ServiceLimits } from "@/constants";

interface PendingInvalidation {
  filePath: string;
  type: "file" | "workspace" | "relevance";
}

export class ProjectContextCacheInvalidationService {
  private logger: Logger;
  private fileWatcher: FileSystemWatcher | null = null;
  private disposables: Disposable[] = [];
  private debouncedInvalidate: DebouncedFunction<(uri: string) => Promise<void>> | null = null;
  private pendingInvalidations: PendingInvalidation[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100;

  constructor(
    private cacheService: ProjectContextCacheService,
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private loggingService: LoggingService,
    private debouncingService: DebouncingService,
  ) {
    this.logger = createLogger("ProjectContextCacheInvalidationService");
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
        if (this.debouncedInvalidate) {
          this.debouncedInvalidate(uri.fsPath);
        }
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

  private addInvalidation(type: "file" | "workspace" | "relevance", filePath: string): void {
    this.pendingInvalidations.push({ type, filePath });

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.executeBatch();
      }, this.BATCH_DELAY);
    }
  }

  private async executeBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const invalidations = this.pendingInvalidations.splice(0);
    if (invalidations.length === 0) {
      return;
    }

    this.logger.debug("Executing batch invalidation", { count: invalidations.length });

    const filePaths = new Set<string>();
    const workspaceInvalidations = new Set<string>();

    for (const inv of invalidations) {
      filePaths.add(inv.filePath);
      if (inv.type === "workspace") {
        workspaceInvalidations.add(inv.filePath);
      }
    }

    const uniqueFilePaths = Array.from(filePaths);

    await Promise.all([
      this.invalidateFilesBatch(uniqueFilePaths),
      this.invalidateWorkspaceBatch(Array.from(workspaceInvalidations)),
    ]);
  }

  private async invalidateFilesBatch(filePaths: string[]): Promise<void> {
    if (filePaths.length === 0) {
      return;
    }

    const affectedCacheKeys = new Set<string>();

    for (const filePath of filePaths) {
      const affected = await this.determineAffectedCaches(filePath);
      affected.forEach((key) => affectedCacheKeys.add(key));
    }

    if (affectedCacheKeys.size > 0) {
      await Promise.all(Array.from(affectedCacheKeys).map((key) => this.cacheService.delete(key)));
      this.logger.info("Batch invalidated cache entries", {
        count: affectedCacheKeys.size,
        fileCount: filePaths.length,
      });
    }
  }

  private async invalidateWorkspaceBatch(filePaths: string[]): Promise<void> {
    if (filePaths.length === 0) {
      return;
    }

    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const workspaceRoots = new Set<string>();
    for (const filePath of filePaths) {
      if (this.shouldInvalidateWorkspaceStructure(filePath)) {
        for (const folder of workspaceFolders) {
          if (filePath.startsWith(folder.uri.fsPath)) {
            workspaceRoots.add(folder.uri.fsPath);
          }
        }
      }
    }

    await Promise.all(
      Array.from(workspaceRoots).map((root) => this.workspaceStructureCache.clear(root)),
    );

    await Promise.all(
      filePaths.map((filePath) => this.workspaceStructureCache.deleteDependencyMap(filePath)),
    );

    if (workspaceRoots.size > 0) {
      this.logger.info("Batch invalidated workspace structure cache", {
        workspaceCount: workspaceRoots.size,
        fileCount: filePaths.length,
      });
    }
  }

  private async determineAffectedCaches(filePath: string): Promise<string[]> {
    const affected: string[] = [];
    const dependentFilePaths = new Set<string>();

    dependentFilePaths.add(filePath);

    try {
      const dependencyMap = await this.workspaceStructureCache.getDependencyMap(filePath);
      if (dependencyMap && dependencyMap.dependents) {
        for (const dependent of dependencyMap.dependents) {
          dependentFilePaths.add(dependent);
        }
      }
    } catch (error) {
      this.logger.debug("Failed to get dependency map for smart invalidation", {
        filePath,
        error,
      });
    }

    const allKeys = await this.cacheService.getAllKeys();
    for (const key of allKeys) {
      const metadata = await this.cacheService.getMetadata(key);
      if (metadata) {
        if (metadata.packageJsonPath === filePath) {
          affected.push(key);
        } else if (metadata.filePath && dependentFilePaths.has(metadata.filePath)) {
          affected.push(key);
        }
      }
    }

    return affected;
  }

  private async invalidateCacheForFile(filePath: string): Promise<void> {
    const invalidationType = this.shouldInvalidateWorkspaceStructure(filePath)
      ? "workspace"
      : "file";
    this.addInvalidation(invalidationType, filePath);
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

      const workspaceFolders = workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        for (const folder of workspaceFolders) {
          await this.workspaceStructureCache.clear(folder.uri.fsPath);
        }
        this.logger.info("Invalidated workspace structure cache for all workspaces");
      }
    } catch (error) {
      this.logger.error("Error clearing cache", { error });
    }
  }

  dispose(): void {
    this.logger.debug("Disposing ProjectContextCacheInvalidationService");
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.debouncedInvalidate) {
      this.debouncedInvalidate.cancel();
    }
    if (this.pendingInvalidations.length > 0) {
      this.executeBatch();
    }
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.fileWatcher = null;
    this.debouncedInvalidate = null;
    this.pendingInvalidations = [];
  }
}
