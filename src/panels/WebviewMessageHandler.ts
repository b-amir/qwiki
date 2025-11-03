import type { Webview } from "vscode";
import { Inbound, Outbound } from "./constants";
import { ServiceLimits } from "../constants";
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

export class WebviewMessageHandler {
  private logger: Logger;
  private _lastCommandExecutionTime = new Map<string, number>();
  private readonly COMMAND_THROTTLE_DELAY = ServiceLimits.commandThrottleDelay;

  constructor(
    private webview: Webview,
    private messageBus: MessageBusService | undefined,
    private commandRegistry: CommandRegistry | undefined,
    private errorHandler: ErrorHandler | undefined,
    private initPromise: Promise<void>,
    private loggingService: LoggingService,
    private onCancelGeneration: () => void,
    private navigationManager?: NavigationManager,
  ) {
    this.logger = createLogger("WebviewMessageHandler", loggingService);
  }

  setupMessageListener(): void {
    this.webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command as string;
        const payload = message.payload;

        try {
          const receiveTs = Date.now();

          const silentCommands = new Set(["frontendLog", "webviewReady", "getEnvironmentStatus"]);
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
                const data = payload?.data;

                if (level === "error") {
                  this.logger.error(`Frontend: ${msg}`, data);
                } else if (level === "warn") {
                  this.logger.warn(`Frontend: ${msg}`, data);
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
    if (this.navigationManager) {
      this.navigationManager.setWebviewReady(true);
      this.navigationManager.flushPendingNavigation();
      this.navigationManager.flushPendingSelection();
    }
    if (this.messageBus) {
      try {
        this.messageBus.postSuccess(Outbound.webviewReady, { ready: true });
      } catch (error) {
        this.logger.error("Exception in handleWebviewReady", error);
      }
    }
  }

  private async handleCommand(command: string, payload: any, receiveTs: number): Promise<void> {
    if (!this.commandRegistry) {
      const ignoreCommands = new Set(["webviewReady", "frontendLog"]);
      if (!ignoreCommands.has(command)) {
        this.logger.debug(`Command ${command} received before registry initialized, ignoring`);
      }
      return;
    }

    if (!this.commandRegistry.has(command)) {
      this.logger.warn(`Command not found in registry`, { command });
      return;
    }

    const executeStart = Date.now();
    await this.initPromise.catch((e) => {
      this.logger.error("Initialization failed before command execution", {
        command,
        error: e,
      });
    });

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
