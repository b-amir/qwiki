import { workspace, FileSystemWatcher, Disposable, Uri } from "vscode";
import type { ExtensionContext } from "vscode";
import { join } from "path";
import { EventBus } from "@/events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import type {
  GitChangeDetectionService,
  ChangedFile,
} from "../integration/GitChangeDetectionService";
import {
  DebouncingService,
  type DebouncedFunction,
} from "@/infrastructure/services/optimization/DebouncingService";
import { ServiceLimits } from "@/constants/ServiceLimits";

export class WikiWatcherService {
  private watcher: FileSystemWatcher | undefined;
  private backupWatcher: FileSystemWatcher | undefined;
  private logger: Logger;
  private disposables: Disposable[] = [];
  private gitUnsubscribe: (() => void) | null = null;
  private savedFolderPath: string | undefined;
  private backupFolderPath: string | undefined;
  private debouncedRefresh: DebouncedFunction<() => Promise<void>> | null = null;

  constructor(
    private eventBus: EventBus,
    private ctx: ExtensionContext,
    private loggingService: LoggingService,
    private debouncingService: DebouncingService,
    private gitChangeDetectionService?: GitChangeDetectionService,
  ) {
    this.logger = createLogger("WikiWatcherService");
    this.initializeSavedFolderPath();
  }

  private initializeSavedFolderPath(): void {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders?.length) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      this.savedFolderPath = join(workspaceRoot, ".qwiki", "saved");
      this.backupFolderPath = join(workspaceRoot, ".qwiki", "backup");
    }
  }

  startWatching(): void {
    this.logger.debug("Starting wiki file watcher", { savedFolderPath: this.savedFolderPath });

    this.debouncedRefresh = this.debouncingService.debounce(
      async () => {
        await this.refreshSavedWikis();
      },
      ServiceLimits.projectContextCacheInvalidationDebounce,
      { leading: false, trailing: true },
    );

    const pattern = "**/.qwiki/saved/**/*.md";
    this.watcher = workspace.createFileSystemWatcher(pattern);

    this.watcher.onDidCreate((uri) => {
      this.logger.info(`Wiki file created: ${uri.fsPath}`);
      if (this.debouncedRefresh) {
        this.debouncedRefresh();
      }
    });

    this.watcher.onDidDelete((uri) => {
      this.logger.info(`Wiki file deleted: ${uri.fsPath}`);
      if (this.debouncedRefresh) {
        this.debouncedRefresh();
      }
    });

    this.watcher.onDidChange((uri) => {
      this.logger.info(`Wiki file changed: ${uri.fsPath}`);
      if (this.debouncedRefresh) {
        this.debouncedRefresh();
      }
    });

    this.disposables.push(this.watcher);
    this.ctx.subscriptions.push(this.watcher);

    this.setupGitWatcher();

    this.logger.info("Wiki file watcher started", {
      pattern,
      savedFolderPath: this.savedFolderPath,
      gitWatcherEnabled: !!this.gitChangeDetectionService,
    });

    this.startBackupWatcher();
  }

  private setupGitWatcher(): void {
    if (!this.gitChangeDetectionService) {
      this.logger.debug(
        "Git change detection service not available, using file system watcher only",
      );
      return;
    }

    if (!this.savedFolderPath) {
      this.logger.debug("Saved folder path not initialized, skipping git watcher setup");
      return;
    }

    try {
      this.gitUnsubscribe = this.gitChangeDetectionService.subscribeToChanges(
        (changedFiles: ChangedFile[]) => {
          const normalizedSavedPath = this.savedFolderPath!.replace(/\\/g, "/");
          const normalizedBackupPath = this.backupFolderPath?.replace(/\\/g, "/");
          const wikiFilesChanged = changedFiles.filter((file) => {
            const filePath = file.uri.fsPath.replace(/\\/g, "/");
            return (
              filePath.startsWith(normalizedSavedPath) &&
              filePath.endsWith(".md") &&
              !filePath.endsWith("/")
            );
          });

          if (wikiFilesChanged.length > 0) {
            this.logger.debug(
              `Git changes detected in saved wikis: ${wikiFilesChanged.length} files`,
              {
                files: wikiFilesChanged.map((f) => ({ path: f.uri.fsPath, status: f.status })),
              },
            );
            if (this.debouncedRefresh) {
              this.debouncedRefresh();
            }
          }

          if (normalizedBackupPath) {
            const backupFilesChanged = changedFiles.filter((file) => {
              const filePath = file.uri.fsPath.replace(/\\/g, "/");
              return (
                filePath.startsWith(normalizedBackupPath) &&
                filePath.endsWith(".md") &&
                !filePath.endsWith("/")
              );
            });

            if (backupFilesChanged.length > 0) {
              this.logger.debug(
                `Git changes detected in README backups: ${backupFilesChanged.length} files`,
                {
                  files: backupFilesChanged.map((f) => ({ path: f.uri.fsPath, status: f.status })),
                },
              );
              this.publishBackupEvent("changed", backupFilesChanged[0].uri);
            }
          }
        },
      );

      this.logger.info("Git-based wiki watcher initialized", {
        savedFolderPath: this.savedFolderPath,
      });
    } catch (error) {
      this.logger.error("Failed to setup git watcher for saved wikis", error);
    }
  }

  private startBackupWatcher(): void {
    if (!this.backupFolderPath) {
      return;
    }

    const pattern = "**/.qwiki/backup/**/*.md";
    this.backupWatcher = workspace.createFileSystemWatcher(pattern);

    this.backupWatcher.onDidCreate((uri) => {
      this.logger.info(`README backup created: ${uri.fsPath}`);
      this.publishBackupEvent("created", uri);
    });

    this.backupWatcher.onDidChange((uri) => {
      this.logger.info(`README backup updated: ${uri.fsPath}`);
      this.publishBackupEvent("changed", uri);
    });

    this.backupWatcher.onDidDelete((uri) => {
      this.logger.info(`README backup deleted: ${uri.fsPath}`);
      this.publishBackupEvent("deleted", uri);
    });

    this.disposables.push(this.backupWatcher);
    this.ctx.subscriptions.push(this.backupWatcher);
  }

  private publishBackupEvent(type: "created" | "changed" | "deleted", uri: Uri): void {
    if (type === "deleted") {
      void this.eventBus.publish("readmeBackupDeleted", {});
    } else {
      void this.eventBus.publish("readmeBackupCreated", {
        backupPath: uri.fsPath,
      });
    }
  }

  private async refreshSavedWikis(): Promise<void> {
    try {
      await this.eventBus.publish("savedWikisChanged", {});
      this.logger.debug("Published savedWikisChanged event");
    } catch (error) {
      this.logger.error("Failed to publish savedWikisChanged event", error);
    }
  }

  dispose(): void {
    this.logger.debug("Disposing wiki file watcher");

    if (this.debouncedRefresh) {
      this.debouncedRefresh.cancel();
      this.debouncedRefresh = null;
    }

    if (this.gitUnsubscribe) {
      this.gitUnsubscribe();
      this.gitUnsubscribe = null;
    }

    if (this.backupWatcher) {
      this.backupWatcher.dispose();
      this.backupWatcher = undefined;
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.watcher = undefined;
  }
}
