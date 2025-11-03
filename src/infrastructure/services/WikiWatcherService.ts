import { workspace, FileSystemWatcher, Disposable, Uri } from "vscode";
import type { ExtensionContext } from "vscode";
import { join } from "path";
import { EventBus } from "../../events/EventBus";
import { LoggingService, createLogger, type Logger } from "./LoggingService";
import type { GitChangeDetectionService, ChangedFile } from "./GitChangeDetectionService";

export class WikiWatcherService {
  private watcher: FileSystemWatcher | undefined;
  private logger: Logger;
  private disposables: Disposable[] = [];
  private gitUnsubscribe: (() => void) | null = null;
  private savedFolderPath: string | undefined;

  constructor(
    private eventBus: EventBus,
    private ctx: ExtensionContext,
    private loggingService: LoggingService,
    private gitChangeDetectionService?: GitChangeDetectionService,
  ) {
    this.logger = createLogger("WikiWatcherService", loggingService);
    this.initializeSavedFolderPath();
  }

  private initializeSavedFolderPath(): void {
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders?.length) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      this.savedFolderPath = join(workspaceRoot, ".qwiki", "saved");
    }
  }

  startWatching(): void {
    this.logger.debug("Starting wiki file watcher", { savedFolderPath: this.savedFolderPath });

    const pattern = "**/.qwiki/saved/**/*.md";
    this.watcher = workspace.createFileSystemWatcher(pattern);

    this.watcher.onDidCreate(async (uri) => {
      this.logger.info(`Wiki file created: ${uri.fsPath}`);
      await this.refreshSavedWikis();
    });

    this.watcher.onDidDelete(async (uri) => {
      this.logger.info(`Wiki file deleted: ${uri.fsPath}`);
      await this.refreshSavedWikis();
    });

    this.watcher.onDidChange(async (uri) => {
      this.logger.info(`Wiki file changed: ${uri.fsPath}`);
      await this.refreshSavedWikis();
    });

    this.disposables.push(this.watcher);
    this.ctx.subscriptions.push(this.watcher);

    this.setupGitWatcher();

    this.logger.info("Wiki file watcher started", {
      pattern,
      savedFolderPath: this.savedFolderPath,
      gitWatcherEnabled: !!this.gitChangeDetectionService,
    });
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
            this.refreshSavedWikis();
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

    if (this.gitUnsubscribe) {
      this.gitUnsubscribe();
      this.gitUnsubscribe = null;
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.watcher = undefined;
  }
}
