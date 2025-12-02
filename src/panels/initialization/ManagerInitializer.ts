import type { WebviewView, Webview } from "vscode";
import type { Disposable } from "vscode";
import { LanguageStatusMonitor } from "@/panels/LanguageStatusMonitor";
import { EnvironmentStatusManager } from "@/panels/EnvironmentStatusManager";
import { NavigationManager } from "@/panels/NavigationManager";
import { WebviewMessageHandler } from "@/panels/WebviewMessageHandler";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import type { CommandRegistry } from "@/application";
import type { ErrorHandler } from "@/infrastructure/services";
import type { LoggingService, Logger } from "@/infrastructure/services";
import type { AppBootstrap } from "@/application";

export interface ManagerInitializationResult {
  environmentStatusManager: EnvironmentStatusManager;
  languageStatusMonitor: LanguageStatusMonitor;
  navigationManager: NavigationManager;
  webviewMessageHandler: WebviewMessageHandler;
  disposables: Disposable[];
}

export class ManagerInitializer {
  constructor(
    private messageBus: MessageBusService,
    private view: WebviewView | undefined,
    private bootstrap: AppBootstrap,
    private loggingService: LoggingService,
    private logger: Logger,
    private commandRegistry?: CommandRegistry,
    private errorHandler?: ErrorHandler,
    private cancelGeneration?: () => Promise<void>,
  ) {}

  initializeManagers(
    webview: WebviewView,
    languageStatusMonitorRef?: { current?: LanguageStatusMonitor },
  ): ManagerInitializationResult {
    this.logger.info("Creating EnvironmentStatusManager");
    const environmentStatusManager = new EnvironmentStatusManager(
      this.messageBus,
      this.view,
      {
        getLanguageStatus: () =>
          languageStatusMonitorRef?.current?.getLanguageStatus() || {
            ready: true,
            message: "",
            reason: "unknown",
          },
      },
      this.loggingService,
    );

    const languageStatusMonitor = new LanguageStatusMonitor(this.loggingService, () => {
      environmentStatusManager.broadcastEnvironmentStatus();
    });
    languageStatusMonitor.startMonitoring();
    if (languageStatusMonitorRef) {
      languageStatusMonitorRef.current = languageStatusMonitor;
    }

    const disposables: Disposable[] = [];

    try {
      const eventBus = this.bootstrap.getContainer().resolve("eventBus") as any;
      if (eventBus && typeof eventBus.subscribe === "function") {
        const unsubscribe = eventBus.subscribe(
          "backgroundInitProgress",
          (payload: { completed: number; total: number; percent: number }) => {
            this.logger.debug("Background init progress", payload);
            environmentStatusManager.setInitializationProgress(payload.percent);
          },
        );
        disposables.push({ dispose: unsubscribe });
      }
    } catch (error) {
      this.logger.error("Failed to subscribe to background init progress", error);
    }

    this.logger.info("Creating NavigationManager");
    const navigationManager = new NavigationManager(
      this.messageBus,
      this.view,
      this.loggingService,
    );

    const webviewMessageHandler = new WebviewMessageHandler(
      webview as unknown as Webview,
      this.messageBus,
      this.commandRegistry,
      this.errorHandler,
      this.bootstrap.getCriticalInitPromise(),
      this.bootstrap.getReadinessManager(),
      this.loggingService,
      this.cancelGeneration || (async () => {}),
      navigationManager,
      environmentStatusManager,
    );
    webviewMessageHandler.setupMessageListener();

    environmentStatusManager.flushEnvironmentStatus();

    return {
      environmentStatusManager,
      languageStatusMonitor,
      navigationManager,
      webviewMessageHandler,
      disposables,
    };
  }

  setupStatusCallbacks(
    initPromise: Promise<void>,
    environmentStatusManager: EnvironmentStatusManager,
  ): void {
    const updateStatusWhenReady = () => {
      this.logger.info("Initialization complete, setting extension status to ready");
      environmentStatusManager.setExtensionStatus({
        ready: true,
        message: "Qwiki services ready.",
        reason: "ready",
      });
    };

    const handleInitError = (error: unknown) => {
      this.logger.error("Initialization failed", error);
      environmentStatusManager.setExtensionStatus({
        ready: false,
        message: "Failed to initialize Qwiki services.",
        reason: "error",
      });
    };

    initPromise.then(updateStatusWhenReady).catch(handleInitError);

    initPromise.finally(() => {
      setTimeout(() => {
        if (!environmentStatusManager.getLatestEnvironmentStatus()?.extension?.ready) {
          this.logger.info("Initialization finished but status not set, setting it now");
          updateStatusWhenReady();
        }
      }, 100);
    });
  }
}
