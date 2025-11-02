import { workspace, FileSystemWatcher, Disposable } from "vscode";
import type { ExtensionContext } from "vscode";
import { EventBus } from "../../events/EventBus";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export class WikiWatcherService {
  private watcher: FileSystemWatcher | undefined;
  private logger: Logger;
  private disposables: Disposable[] = [];

  constructor(
    private eventBus: EventBus,
    private ctx: ExtensionContext,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("WikiWatcherService", loggingService);
  }

  startWatching(): void {
    this.logger.debug("Starting wiki file watcher");

    const pattern = "**/.qwiki/**/*.md";
    this.watcher = workspace.createFileSystemWatcher(pattern);

    this.watcher.onDidCreate(async (uri) => {
      this.logger.debug(`Wiki file created: ${uri.fsPath}`);
      await this.refreshSavedWikis();
    });

    this.watcher.onDidDelete(async (uri) => {
      this.logger.debug(`Wiki file deleted: ${uri.fsPath}`);
      await this.refreshSavedWikis();
    });

    this.watcher.onDidChange(async (uri) => {
      this.logger.debug(`Wiki file changed: ${uri.fsPath}`);
      await this.refreshSavedWikis();
    });

    this.disposables.push(this.watcher);
    this.ctx.subscriptions.push(this.watcher);

    this.logger.info("Wiki file watcher started");
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

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
    this.watcher = undefined;
  }
}

