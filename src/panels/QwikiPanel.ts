import { Disposable, WebviewView, Uri, window, ExtensionContext, commands, Webview } from "vscode";
import { AppBootstrap, CommandRegistry } from "@/application";
import { getWebviewHtml } from "@/panels/webviewContent";
import { Pages } from "@/panels/constants";
import { WebviewPaths, VSCodeCommandIds, MessageStrings } from "@/constants";
import type { ErrorHandler } from "@/infrastructure/services";
import { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { LanguageStatusMonitor } from "@/panels/LanguageStatusMonitor";
import { EnvironmentStatusManager } from "@/panels/EnvironmentStatusManager";
import { WebviewMessageHandler } from "@/panels/WebviewMessageHandler";
import { NavigationManager, type SelectionPayload } from "@/panels/NavigationManager";
import { QwikiPanelInitializer } from "@/panels/initialization/QwikiPanelInitializer";
import { PanelUtilities } from "@/panels/utilities/PanelUtilities";
import { FallbackCommandRegistryFactory } from "@/panels/initialization/FallbackCommandRegistryFactory";
import { ManagerInitializer } from "@/panels/initialization/ManagerInitializer";

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
  private _webviewReadyReceived = false;

  constructor(
    extensionUri: Uri,
    private ctx: ExtensionContext,
    bootstrap?: AppBootstrap,
  ) {
    this._extensionUri = extensionUri;
    this.bootstrap = bootstrap || new AppBootstrap(ctx);
    try {
      this.loggingService = this.bootstrap
        .getContainer()
        .resolveTyped("loggingService");
    } catch {
      this.loggingService = new LoggingService();
    }
    this.logger = createLogger("QwikiPanel");
    this._initPromise = this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    const initializer = new QwikiPanelInitializer(
      this.bootstrap,
      this.loggingService,
      this.logger,
      this.environmentStatusManager,
    );

    this.errorHandler = await initializer.initializeAsync();
    initializer.initializeBackgroundServices();
  }

  public async resolveWebviewView(webviewView: WebviewView) {
    this.logger.info("resolveWebviewView called - setting up webview");
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, WebviewPaths.out),
        Uri.joinPath(this._extensionUri, WebviewPaths.webviewBuild),
      ],
    };

    this.view = webviewView;
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);
    this.logger.info("Webview HTML set, creating MessageBus");
    this.messageBus = new MessageBusService(webviewView.webview, this.loggingService);
    this.logger.info("Setting up early message listener for webviewReady");
    this.setupEarlyMessageListener(webviewView.webview);
    this.logger.info("Initializing managers");

    // Wait for critical services before creating command registry
    (async () => {
      try {
        // Wait for critical services to be ready
        await this.bootstrap.getCriticalInitPromise();

        const registry = await this.bootstrap.createCommandRegistry(webviewView.webview);
        this.commandRegistry = registry;
        this.logger.info("createCommandRegistry completed successfully");
        this.setupWikiWatcherListener();

        // Now initialize managers with the registry available
        this.initializeManagers(webviewView.webview);
      } catch (e) {
        this.logger.error("createCommandRegistry failed", {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
          errorType: e?.constructor?.name,
        });
        const fallbackFactory = new FallbackCommandRegistryFactory(
          this.loggingService,
          this.logger,
        );
        this.commandRegistry = fallbackFactory.createFallbackCommandRegistry(webviewView.webview);
        // Initialize managers even with fallback registry
        this.initializeManagers(webviewView.webview);
      }
    })();

    webviewView.onDidDispose(
      async () => {
        try {
          await this.dispose();
        } catch (error) {
          this.logger.error("Error during disposal", error);
        }
      },
      null,
      this._disposables,
    );
  }

  private setupEarlyMessageListener(webview: Webview): void {
    const disposable = webview.onDidReceiveMessage((message: { command: string }) => {
      if (message.command === "webviewReady") {
        this.logger.info("Early webviewReady message received");
        this._webviewReadyReceived = true;
        if (this.navigationManager) {
          this.logger.info("NavigationManager already exists, setting ready immediately");
          this.navigationManager.setWebviewReady(true);
        } else {
          this.logger.debug("NavigationManager not yet created, will set ready when it's created");
        }
      }
    });
    this._disposables.push(disposable);
  }

  private initializeManagers(webview: Webview): void {
    const panelUtilities = new PanelUtilities(this.logger, this.bootstrap, this.navigationManager);
    const languageStatusMonitorRef: { current?: LanguageStatusMonitor } = {};
    const managerInitializer = new ManagerInitializer(
      this.messageBus!,
      this.view,
      this.bootstrap,
      this.loggingService,
      this.logger,
      this.commandRegistry,
      this.errorHandler,
      async (reason?: string) => {
        try {
          await panelUtilities.cancelActiveGeneration(reason);
        } catch (error) {
          this.logger.error("Failed to cancel active generation", error);
        }
      },
    );

    const result = managerInitializer.initializeManagers(this.view!, languageStatusMonitorRef);
    this.environmentStatusManager = result.environmentStatusManager;
    this.languageStatusMonitor = result.languageStatusMonitor;
    this.navigationManager = result.navigationManager;
    this.webviewMessageHandler = result.webviewMessageHandler;
    this._disposables.push(...result.disposables);

    if (this._webviewReadyReceived && this.navigationManager) {
      this.logger.debug("Webview was already ready, setting NavigationManager ready");
      this.navigationManager.setWebviewReady(true);
      if (this.webviewMessageHandler) {
        this.webviewMessageHandler.checkAndHandleEarlyWebviewReady();
      }
    }

    managerInitializer.setupStatusCallbacks(this._initPromise, this.environmentStatusManager);
  }

  private setupWikiWatcherListener(): void {
    try {
      const eventBus = this.bootstrap.getContainer().resolveTyped("eventBus");
      if (eventBus && typeof eventBus.subscribe === "function") {
        const unsubscribe = eventBus.subscribe("savedWikisChanged", async () => {
          this.logger.debug("savedWikisChanged event received, refreshing saved wikis");
          if (this.commandRegistry && this.navigationManager) {
            try {
              await this.commandRegistry.execute("getSavedWikis", {});
            } catch (error) {
              this.logger.error("Failed to refresh saved wikis after file change", error);
            }
          }
        });
        this._disposables.push({ dispose: unsubscribe });
        this.logger.debug("Wiki watcher listener setup completed");
      }
    } catch (error) {
      this.logger.error("Failed to setup wiki watcher listener", error);
    }
  }

  public showPage(page: (typeof Pages)[keyof typeof Pages]) {
    const panelUtilities = new PanelUtilities(this.logger, this.bootstrap, this.navigationManager);
    panelUtilities.cancelActiveGeneration().catch((error) => {
      this.logger.error("Failed to cancel active generation", error);
    });

    commands.executeCommand(VSCodeCommandIds.openPanelView);
    this.view?.show?.(true);

    const queueNavigation = () => {
      this.navigationManager?.queueNavigation(page);
      this.navigationManager?.flushPendingNavigation();
    };

    setTimeout(queueNavigation, 100);
  }

  public createWikiFromEditorSelection() {
    const panelUtilities = new PanelUtilities(this.logger, this.bootstrap, this.navigationManager);
    const payload = panelUtilities.readSelectionFromEditor(false);
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

  getContainer() {
    return this.bootstrap.getContainer();
  }
}
