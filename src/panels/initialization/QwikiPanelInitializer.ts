import type { ExtensionContext } from "vscode";
import type { AppBootstrap } from "@/application";
import type { ErrorHandler } from "@/infrastructure/services";
import type { LoggingService, Logger } from "@/infrastructure/services";
import type { EnvironmentStatusManager } from "@/panels/EnvironmentStatusManager";

export class QwikiPanelInitializer {
  constructor(
    private bootstrap: AppBootstrap,
    private loggingService: LoggingService,
    private logger: Logger,
    private environmentStatusManager?: EnvironmentStatusManager,
  ) {}

  async initializeAsync(): Promise<ErrorHandler> {
    try {
      await this.bootstrap.getCriticalInitPromise();
      this.logger.info("Critical services initialized successfully");
    } catch (e) {
      this.logger.error("Critical services initialization failed", e);
      this.environmentStatusManager?.setExtensionStatus({
        ready: false,
        message: "Failed to initialize Qwiki services.",
        reason: "error",
      });
      return {
        handle: (error: any, context?: any) => {
          this.logger.error("Fallback error handler", { error, context });
        },
      } as ErrorHandler;
    }

    try {
      await this.bootstrap.initializeEventHandlers();
      this.logger.info("initializeEventHandlers completed successfully");
    } catch (e) {
      this.logger.error("initializeEventHandlers failed", e);
      this.environmentStatusManager?.setExtensionStatus({
        ready: false,
        message: "Failed to initialize Qwiki event handlers.",
        reason: "error",
      });
      return {
        handle: (error: any, context?: any) => {
          this.logger.error("Fallback error handler", { error, context });
        },
      } as ErrorHandler;
    }

    try {
      const errorHandler = this.bootstrap.getErrorHandler() as ErrorHandler;
      this.logger.info("errorHandler retrieved successfully");
      return errorHandler;
    } catch (e) {
      this.logger.error("getErrorHandler failed", e);
      return {
        handle: (error: any, context?: any) => {
          this.logger.error("Fallback error handler", { error, context });
        },
      } as ErrorHandler;
    }
  }

  initializeBackgroundServices(): void {
    this.bootstrap
      .getBackgroundInitPromise()
      .then(() => {
        this.logger.info("Background services initialized successfully");
      })
      .catch((e) => {
        this.logger.error("Background services initialization failed", e);
      });
  }
}
