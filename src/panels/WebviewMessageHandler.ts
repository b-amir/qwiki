import type { Webview } from "vscode";
import { Inbound, Outbound } from "./constants";
import { ServiceLimits } from "../constants";
import { IMMEDIATE_COMMANDS, COMMAND_TIMEOUTS } from "../constants/ServiceTiers";
import { tryOpenFile } from "./fileOps";
import { CommandRegistry } from "../application";
import type { ErrorHandler } from "../infrastructure/services/ErrorHandler";
import { MessageBusService } from "../application/services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import type { NavigationManager } from "./NavigationManager";
import type { ServiceReadinessManager } from "../infrastructure/services/ServiceReadinessManager";

export class WebviewMessageHandler {
  private logger: Logger;
  private _lastCommandExecutionTime = new Map<string, number>();
  private readonly COMMAND_THROTTLE_DELAY = ServiceLimits.commandThrottleDelay;

  constructor(
    private webview: Webview,
    private messageBus: MessageBusService | undefined,
    private commandRegistry: CommandRegistry | undefined,
    private errorHandler: ErrorHandler | undefined,
    private criticalInitPromise: Promise<void>,
    private readinessManager: ServiceReadinessManager | undefined,
    private loggingService: LoggingService,
    private onCancelGeneration: () => void,
    private navigationManager?: NavigationManager,
  ) {
    this.logger = createLogger("WebviewMessageHandler");
  }

  setupMessageListener(): void {
    this.webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command as string;
        const payload = message.payload;

        try {
          const receiveTs = Date.now();

          const silentCommands = new Set([
            "frontendLog",
            "webviewReady",
            "getEnvironmentStatus",
            "getSelection",
            "getProviders",
            "getProviderCapabilities",
            "getApiKeys",
            "getConfigurationTemplates",
            "getConfigurationBackups",
          ]);
          if (!silentCommands.has(command)) {
            this.logger.debug(`Received webview message - command=${command}`);
          }

          if (command === "getSavedWikis") {
            const lastTime = this._lastCommandExecutionTime.get(command) || 0;
            if (receiveTs - lastTime < this.COMMAND_THROTTLE_DELAY) {
              this.logger.debug(
                `Throttling getSavedWikis command, last executed ${receiveTs - lastTime}ms ago`,
              );
              return;
            }
            this._lastCommandExecutionTime.set(command, receiveTs);
          }

          switch (command) {
            case "frontendLog": {
              try {
                const msg = payload?.message ?? "";
                const level = payload?.level || "debug";
                const source = payload?.source || "Frontend";
                const data = payload?.data;

                if (level === "error") {
                  this.loggingService.error(source, msg, data);
                } else if (level === "warn") {
                  this.loggingService.warn(source, msg, data);
                } else if (level === "info") {
                  this.loggingService.info(source, msg, data);
                } else {
                  this.loggingService.debug(source, msg, data);
                }
              } catch (e) {
                this.logger.warn("Frontend log formatting error");
              }
              return;
            }
            case Inbound.webviewReady: {
              this.handleWebviewReady();
              return;
            }
            case Inbound.openFile: {
              const { path, line } = payload as { path: string; line?: number };
              await tryOpenFile(path, line);
              return;
            }
            case Inbound.getEnvironmentStatus: {
              return;
            }
            case "cancelWikiGeneration": {
              this.onCancelGeneration();
              return;
            }
            default: {
              await this.handleCommand(command, payload, receiveTs);
              return;
            }
          }
        } catch (err: any) {
          this.errorHandler?.handle(err, { source: "webviewMessage", command });
        }
      },
      undefined,
      [],
    );
  }

  private handleWebviewReady(): void {
    this.logger.info("handleWebviewReady called");
    if (this.navigationManager) {
      this.logger.debug("Setting webview ready on NavigationManager");
      this.navigationManager.setWebviewReady(true);
      this.navigationManager.flushPendingNavigation();
      this.navigationManager.flushPendingSelection();
    } else {
      this.logger.warn("NavigationManager not available when webviewReady received");
    }
    if (this.messageBus) {
      try {
        this.logger.debug("Sending webviewReady success response");
        this.messageBus.postSuccess(Outbound.webviewReady, { ready: true });
      } catch (error) {
        this.logger.error("Exception in handleWebviewReady", error);
      }
    } else {
      this.logger.warn("MessageBus not available when webviewReady received");
    }
  }

  private async handleCommand(command: string, payload: any, receiveTs: number): Promise<void> {
    // Commands that work immediately (no service dependencies)
    if (IMMEDIATE_COMMANDS.has(command)) {
      if (!this.commandRegistry) {
        this.logger.debug(`Command ${command} received before registry initialized, ignoring`);
        return;
      }

      if (!this.commandRegistry.has(command)) {
        this.logger.warn(`Command not found in registry`, { command });
        return;
      }

      try {
        await this.commandRegistry.execute(command, payload);
      } catch (error) {
        this.logger.error(`Immediate command ${command} failed`, error);
        this.errorHandler?.handle(error as Error, { source: "webviewMessage", command });
      }
      return;
    }

    // Wait for critical services only (< 500ms)
    try {
      await this.criticalInitPromise;
    } catch (e) {
      this.logger.error("Critical services initialization failed", {
        command,
        error: e,
      });
      if (this.messageBus) {
        this.messageBus.postError(
          "Extension initialization failed. Please reload the window.",
          "INIT_FAILED",
          "Reload Window",
          { command },
        );
      }
      return;
    }

    if (!this.commandRegistry) {
      this.logger.warn(
        `Command ${command} received but registry not available after critical init`,
      );
      return;
    }

    if (!this.commandRegistry.has(command)) {
      this.logger.warn(`Command not found in registry`, { command });
      return;
    }

    // Check if command can execute now
    if (this.readinessManager && !this.readinessManager.canExecuteCommand(command)) {
      const requiredServices = this.readinessManager.getRequiredServices(command);
      const unreadyServices = requiredServices.filter((s) => !this.readinessManager!.isReady(s));

      this.logger.info(`Command ${command} waiting for services`, { unreadyServices });

      // Show loading state in UI
      if (this.messageBus) {
        this.messageBus.postImmediate("commandWaiting", {
          command,
          waitingFor: unreadyServices,
          message: `Initializing ${unreadyServices.join(", ")}...`,
        });
      }

      // Wait for required services (with timeout)
      const timeout = COMMAND_TIMEOUTS[command] || COMMAND_TIMEOUTS.default;
      const waitPromises = unreadyServices.map((s) =>
        this.readinessManager!.waitForService(s, timeout),
      );

      const ready = await Promise.race([
        Promise.all(waitPromises),
        new Promise<boolean[]>((resolve) => setTimeout(() => resolve([false]), timeout)),
      ]);

      if (!ready.every((r) => r)) {
        this.logger.error(`Command ${command} timed out waiting for services`, { unreadyServices });
        if (this.messageBus) {
          this.messageBus.postError(
            `Command timed out waiting for services: ${unreadyServices.join(", ")}`,
            "SERVICE_TIMEOUT",
            "Try again in a moment",
            { command, unreadyServices },
          );
        }
        return;
      }
    }

    const executeStart = Date.now();
    try {
      await this.commandRegistry.execute(command, payload);
      const totalDuration = Date.now() - receiveTs;
      const importantCommands = new Set(["generateWiki", "saveWiki"]);
      if (importantCommands.has(command) || totalDuration > 100) {
        this.logger.info(`Command executed`, {
          command,
          duration: totalDuration,
        });
      }
    } catch (err: any) {
      this.logger.error("Command execution failed", {
        command,
        duration: Date.now() - executeStart,
        error: err?.message,
        stack: err?.stack,
      });
      throw err;
    }
  }
}
