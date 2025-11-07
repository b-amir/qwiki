import { Disposable, WebviewView, Uri, window, ExtensionContext, commands } from "vscode";
import { AppBootstrap, CommandRegistry } from "../application";
import { getWebviewHtml } from "./webviewContent";
import { Pages } from "./constants";
import { WebviewPaths, VSCodeCommandIds, MessageStrings } from "../constants";
import type { ErrorHandler } from "../infrastructure/services/ErrorHandler";
import { MessageBusService } from "../application/services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import { LanguageStatusMonitor } from "./LanguageStatusMonitor";
import { EnvironmentStatusManager } from "./EnvironmentStatusManager";
import { WebviewMessageHandler } from "./WebviewMessageHandler";
import { NavigationManager, type SelectionPayload } from "./NavigationManager";

export class QwikiPanel {
  private readonly _extensionUri: Uri;
  private view?: WebviewView;
  private _disposables: Disposable[] = [];
  private bootstrap: AppBootstrap;
  private commandRegistry: CommandRegistry | undefined;
  private errorHandler: ErrorHandler | undefined;
  private _initPromise: Promise<void>;
  private messageBus: MessageBusService | undefined;
  private loggingService: LoggingService;
  private logger: Logger;
  private languageStatusMonitor: LanguageStatusMonitor | undefined;
  private environmentStatusManager: EnvironmentStatusManager | undefined;
  private webviewMessageHandler: WebviewMessageHandler | undefined;
  private navigationManager: NavigationManager | undefined;

  constructor(
    extensionUri: Uri,
    private ctx: ExtensionContext,
  ) {
    this._extensionUri = extensionUri;
    this.bootstrap = new AppBootstrap(ctx);
    try {
      this.loggingService = this.bootstrap
        .getContainer()
        .resolve("loggingService") as LoggingService;
    } catch {
      this.loggingService = new LoggingService();
    }
    this.logger = createLogger("QwikiPanel");
    this._initPromise = this.initializeAsync();
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logInfo(message: string, data?: unknown): void {
    this.logger.info(message, data);
  }

  private logWarn(message: string, data?: unknown): void {
    this.logger.warn(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  private async initializeAsync(): Promise<void> {
    try {
      // Wait for critical services only (< 500ms)
      await this.bootstrap.getCriticalInitPromise();
      this.logInfo("Critical services initialized successfully");
    } catch (e) {
      this.logError("Critical services initialization failed", e);
      this.environmentStatusManager?.setExtensionStatus({
        ready: false,
        message: "Failed to initialize Qwiki services.",
        reason: "error",
      });
      return;
    }

    try {
      await this.bootstrap.initializeEventHandlers();
      this.logInfo("initializeEventHandlers completed successfully");
    } catch (e) {
      this.logError("initializeEventHandlers failed", e);
      this.environmentStatusManager?.setExtensionStatus({
        ready: false,
        message: "Failed to initialize Qwiki event handlers.",
        reason: "error",
      });
      return;
    }

    try {
      this.errorHandler = this.bootstrap.getErrorHandler() as ErrorHandler;
      this.logInfo("errorHandler retrieved successfully");
    } catch (e) {
      this.logError("getErrorHandler failed", e);
      this.errorHandler = {
        handle: (error: any, context?: any) => {
          this.logError("Fallback error handler", { error, context });
        },
      } as ErrorHandler;
    }

    // Background services initialize asynchronously
    this.bootstrap
      .getBackgroundInitPromise()
      .then(() => {
        this.logInfo("Background services initialized successfully");
      })
      .catch((e) => {
        this.logError("Background services initialization failed", e);
      });
  }

  public async resolveWebviewView(webviewView: WebviewView) {
    this.logInfo("resolveWebviewView called - setting up webview");
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, WebviewPaths.out),
        Uri.joinPath(this._extensionUri, WebviewPaths.webviewBuild),
      ],
    };

    this.view = webviewView;
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);
    this.logInfo("Webview HTML set, creating MessageBus");
    this.messageBus = new MessageBusService(webviewView.webview, this.loggingService);
    this.logInfo("Initializing managers");

    // Wait for critical services before creating command registry
    (async () => {
      try {
        // Wait for critical services to be ready
        await this.bootstrap.getCriticalInitPromise();

        const registry = await this.bootstrap.createCommandRegistry(webviewView.webview);
        this.commandRegistry = registry;
        this.logInfo("createCommandRegistry completed successfully");
        this.setupWikiWatcherListener();

        // Now initialize managers with the registry available
        this.initializeManagers(webviewView.webview);
      } catch (e) {
        this.logError("createCommandRegistry failed", {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
          errorType: e?.constructor?.name,
        });
        this.createFallbackCommandRegistry(webviewView.webview);
        // Initialize managers even with fallback registry
        this.initializeManagers(webviewView.webview);
      }
    })();

    webviewView.onDidDispose(
      async () => {
        try {
          await this.dispose();
        } catch (error) {
          this.logError("Error during disposal", error);
        }
      },
      null,
      this._disposables,
    );
  }

  private initializeManagers(webview: any): void {
    this.logInfo("Creating EnvironmentStatusManager");
    this.environmentStatusManager = new EnvironmentStatusManager(
      this.messageBus,
      this.view,
      {
        getLanguageStatus: () =>
          this.languageStatusMonitor?.getLanguageStatus() || {
            ready: true,
            message: "",
            reason: "unknown",
          },
      },
      this.loggingService,
    );

    this.languageStatusMonitor = new LanguageStatusMonitor(this.loggingService, () => {
      this.environmentStatusManager?.broadcastEnvironmentStatus();
    });
    this.languageStatusMonitor.startMonitoring();

    // Subscribe to background initialization progress
    try {
      const eventBus = this.bootstrap.getContainer().resolve("eventBus") as any;
      if (eventBus && typeof eventBus.subscribe === "function") {
        const unsubscribe = eventBus.subscribe(
          "backgroundInitProgress",
          (payload: { completed: number; total: number; percent: number }) => {
            this.logDebug("Background init progress", payload);
            this.environmentStatusManager?.setInitializationProgress(payload.percent);
          },
        );
        this._disposables.push({ dispose: unsubscribe });
      }
    } catch (error) {
      this.logError("Failed to subscribe to background init progress", error);
    }

    this.logInfo("Creating NavigationManager");
    this.navigationManager = new NavigationManager(this.messageBus, this.view, this.loggingService);

    this.webviewMessageHandler = new WebviewMessageHandler(
      webview,
      this.messageBus,
      this.commandRegistry,
      this.errorHandler,
      this.bootstrap.getCriticalInitPromise(),
      this.bootstrap.getReadinessManager(),
      this.loggingService,
      async () => {
        try {
          await this.cancelActiveGeneration();
        } catch (error) {
          this.logError("Failed to cancel active generation", error);
        }
      },
      this.navigationManager,
    );
    this.webviewMessageHandler.setupMessageListener();

    this.environmentStatusManager.flushEnvironmentStatus();

    const updateStatusWhenReady = () => {
      this.logInfo("Initialization complete, setting extension status to ready");
      if (this.environmentStatusManager) {
        this.environmentStatusManager.setExtensionStatus({
          ready: true,
          message: "Qwiki services ready.",
          reason: "ready",
        });
      }
    };

    const handleInitError = (error: any) => {
      this.logError("Initialization failed", error);
      if (this.environmentStatusManager) {
        this.environmentStatusManager.setExtensionStatus({
          ready: false,
          message: "Failed to initialize Qwiki services.",
          reason: "error",
        });
      }
    };

    this._initPromise.then(updateStatusWhenReady).catch(handleInitError);

    this._initPromise.finally(() => {
      setTimeout(() => {
        if (
          this.environmentStatusManager &&
          !this.environmentStatusManager.getLatestEnvironmentStatus()?.extension?.ready
        ) {
          this.logInfo("Initialization finished but status not set, setting it now");
          updateStatusWhenReady();
        }
      }, 100);
    });
  }

  private setupWikiWatcherListener(): void {
    try {
      const eventBus = this.bootstrap.getContainer().resolve("eventBus") as any;
      if (eventBus && typeof eventBus.subscribe === "function") {
        const unsubscribe = eventBus.subscribe("savedWikisChanged", async () => {
          this.logDebug("savedWikisChanged event received, refreshing saved wikis");
          if (this.commandRegistry && this.navigationManager) {
            try {
              await this.commandRegistry.execute("getSavedWikis", {});
            } catch (error) {
              this.logError("Failed to refresh saved wikis after file change", error);
            }
          }
        });
        this._disposables.push({ dispose: unsubscribe });
        this.logDebug("Wiki watcher listener setup completed");
      }
    } catch (error) {
      this.logError("Failed to setup wiki watcher listener", error);
    }
  }

  public showPage(page: (typeof Pages)[keyof typeof Pages]) {
    this.cancelActiveGeneration().catch((error) => {
      this.logError("Failed to cancel active generation", error);
    });
    this.navigationManager?.queueNavigation(page);
    commands.executeCommand(VSCodeCommandIds.openPanelView);
    this.view?.show?.(true);
  }

  public createWikiFromEditorSelection() {
    const payload = this.readSelectionFromEditor(false);
    if (!payload) {
      window.showInformationMessage(MessageStrings.openFileToCreate);
      return;
    }
    if (!payload.text.trim()) {
      window.showInformationMessage(MessageStrings.selectCodeToBuild);
      return;
    }
    this.navigationManager?.queueSelection(payload, { autoGenerate: true });
    this.showPage(Pages.wiki);
    this.navigationManager?.flushPendingSelection();
  }

  public showSavedWikis() {
    this.showPage(Pages.savedWikis);
  }

  public async dispose(): Promise<void> {
    this.languageStatusMonitor?.clearInterval();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    if (this.messageBus) {
      this.messageBus.dispose();
      this.messageBus = undefined;
    }

    this.commandRegistry?.dispose?.();

    await this.bootstrap.dispose();

    if (this.view) {
      this.view.webview.html = "";
    }

    this.view = undefined;
  }

  private async cancelActiveGeneration(): Promise<void> {
    try {
      const container = this.bootstrap.getContainer();
      const handler = await container.resolveLazy("wikiEventHandler");
      if (handler && typeof (handler as any).cancelActiveGeneration === "function") {
        (handler as any).cancelActiveGeneration();
      }
    } catch (error) {
      this.logDebug("Failed to cancel active generation", error);
    }
  }

  private readSelectionFromEditor(allowFallback = true): SelectionPayload | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return allowFallback ? this.navigationManager?.getLastSelection() : undefined;
    }
    const { document, selection } = editor;
    const hasSelection = selection && !selection.isEmpty;
    const text = hasSelection ? document.getText(selection) : document.getText();
    return {
      text: text ?? "",
      languageId: document.languageId,
      filePath: document.uri.fsPath,
    };
  }

  private createFallbackCommandRegistry(webview: any): void {
    this.logWarn("Creating fallback command registry with limited functionality");

    const fallbackRegistry = new CommandRegistry(this.loggingService);

    const originalExecute = fallbackRegistry.execute.bind(fallbackRegistry);
    const originalRegister = fallbackRegistry.register.bind(fallbackRegistry);

    fallbackRegistry.execute = async <T>(name: string, payload: T): Promise<void> => {
      this.logWarn(
        `Fallback command registry attempting to execute command "${name}" - initialization may have failed`,
      );
      try {
        return await originalExecute(name, payload);
      } catch (error) {
        this.logError(`Fallback command registry command "${name}" failed`, error);
        throw new Error(
          `Command "${name}" cannot be executed due to initialization failure: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    fallbackRegistry.register = <T>(name: string, command: any): void => {
      this.logInfo(`Fallback command registry registered command "${name}"`);
      return originalRegister(name, command);
    };

    this.commandRegistry = fallbackRegistry;
  }

  getContainer() {
    return this.bootstrap.getContainer();
  }
}
