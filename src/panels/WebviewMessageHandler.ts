import type { Webview } from "vscode";
import { Inbound, Outbound } from "@/panels/constants";
import { ServiceLimits } from "@/constants";
import { IMMEDIATE_COMMANDS, COMMAND_TIMEOUTS } from "@/constants/ServiceTiers";
import { tryOpenFile } from "@/panels/fileOps";
import { CommandRegistry } from "@/application";
import type { ErrorHandler } from "@/infrastructure/services";
import { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import type { NavigationManager } from "@/panels/NavigationManager";
import type { ServiceReadinessManager } from "@/infrastructure/services/ServiceReadinessManager";
import type { EnvironmentStatusManager } from "@/panels/EnvironmentStatusManager";

export class WebviewMessageHandler {
  private logger: Logger;
  private _lastCommandExecutionTime = new Map<string, number>();
  private readonly COMMAND_THROTTLE_DELAY = ServiceLimits.commandThrottleDelay;
  private _initialDataSent = false;
  private _initialDataRetryCount = 0;
  private readonly MAX_INITIAL_DATA_RETRIES = 50;

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
    private environmentStatusManager?: EnvironmentStatusManager,
  ) {
    this.logger = createLogger("WebviewMessageHandler");
  }

  checkAndHandleEarlyWebviewReady(): void {
    this.logger.info("Handling early webviewReady - triggering handleWebviewReady");
    this.handleWebviewReady();
  }

  setupMessageListener(): void {
    this.webview.onDidReceiveMessage(
      async (message: { command: string; payload?: Record<string, unknown> }) => {
        const command = message.command;
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
                const logPayload = payload as Record<string, unknown> | undefined;
                const msg = (logPayload?.message as string) ?? "";
                const level = (logPayload?.level as string) || "debug";
                const source = (logPayload?.source as string) || "Frontend";
                const data = logPayload?.data;

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
        } catch (err: unknown) {
          const errorObj = err instanceof Error ? err : new Error(String(err));
          this.errorHandler?.handle(errorObj, { source: "webviewMessage", command });
        }
      },
      undefined,
      [],
    );
  }

  private handleWebviewReady(): void {
    this.logger.debug("handleWebviewReady called");
    if (this.navigationManager) {
      this.navigationManager.setWebviewReady(true);
      this.navigationManager.flushPendingNavigation();
      this.navigationManager.flushPendingSelection();
    } else {
      this.logger.warn("NavigationManager not available when webviewReady received");
    }
    if (this.messageBus) {
      try {
        this.messageBus.postSuccess(Outbound.webviewReady, { ready: true });
      } catch (error) {
        this.logger.error("Exception in handleWebviewReady", error);
      }
    } else {
      this.logger.warn("MessageBus not available when webviewReady received");
    }

    if (this.environmentStatusManager) {
      this.environmentStatusManager.flushEnvironmentStatus();
    }

    this._initialDataSent = false;
    this.sendInitialData();
  }

  private async sendInitialData(): Promise<void> {
    if (this._initialDataSent) {
      return;
    }

    try {
      await this.criticalInitPromise;
    } catch (error) {
      this.logger.error("Critical services initialization failed, cannot send initial data", error);
      return;
    }

    if (!this.commandRegistry) {
      if (this._initialDataRetryCount < this.MAX_INITIAL_DATA_RETRIES) {
        this._initialDataRetryCount++;
        this.logger.debug("Command registry not available yet, will retry", {
          retryCount: this._initialDataRetryCount,
        });
        setTimeout(() => this.sendInitialData(), 100);
        return;
      } else {
        this.logger.warn("Command registry not available after max retries, giving up");
        return;
      }
    }

    this._initialDataSent = true;
    const commandsToSend = ["getProviders", "getApiKeys"];
    for (const command of commandsToSend) {
      if (this.commandRegistry.has(command)) {
        try {
          this.logger.debug(`Automatically sending ${command} after webview ready`);
          await this.commandRegistry.execute(command, {});
        } catch (error) {
          this.logger.error(`Failed to automatically send ${command}`, error);
        }
      } else {
        this.logger.debug(`Command ${command} not found in registry, skipping`);
      }
    }
  }

  private async handleCommand(
    command: string,
    payload: Record<string, unknown> | undefined,
    receiveTs: number,
  ): Promise<void> {
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
    } catch (err: unknown) {
      const errorObj = err as Error | null;
      this.logger.error("Command execution failed", {
        command,
        duration: Date.now() - executeStart,
        error: errorObj?.message,
        stack: errorObj?.stack,
      });
      throw err;
    }
  }
}
