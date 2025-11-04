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

                const spammySources = [
                  "BatchBridge",
                  "SettingsMessaging",
                  "SettingsStore",
                  "SettingsHandlers",
                  "SettingsPage",
                  "useNavigation",
                  "SettingsInitialization",
                ];

                const spammyMessagePatterns = [
                  /Batch received:/i,
                  /Forwarded \d+ messages/i,
                  /Batch performance stats/i,
                  /High latency for/i,
                  /Message .* processed in \d+ms/i,
                  /Message batch processed in/i,
                  /Received capabilities for \d+ providers/i,
                  /Received \d+ provider configs/i,
                  /Received \d+ configuration/i,
                  /Updating API key for provider/i,
                  /API key update completed in/i,
                  /Changing provider to/i,
                  /Provider change completed in/i,
                  /setPage called/i,
                  /No navigation guard set/i,
                  /Navigation guard returned/i,
                  /Navigation guard triggered/i,
                  /Settings error watch triggered/i,
                  /Settings errorInfo watch triggered/i,
                  /Starting initialization/i,
                  /Fetching provider data/i,
                  /Provider data requests sent in/i,
                  /Total initialization time:/i,
                  /validateAndNavigate called/i,
                  /Checking for API keys/i,
                  /Message listener attached/i,
                  /Sending initialization messages/i,
                  /Navigation blocked by guard/i,
                  /Already on page/i,
                  /Calling navigation guard for/i,
                ];

                const isSpammySource = spammySources.includes(source);
                const isSpammyMessage = spammyMessagePatterns.some((pattern) => pattern.test(msg));

                if (level === "error") {
                  this.loggingService.error(source, msg, data);
                } else if (level === "warn") {
                  this.loggingService.warn(source, msg, data);
                } else if (level === "info") {
                  if (isSpammySource && isSpammyMessage) {
                    return;
                  }
                  this.loggingService.info(source, msg, data);
                } else {
                  if (isSpammySource || isSpammyMessage) {
                    return;
                  }
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
    if (!this.commandRegistry) {
      const ignoreCommands = new Set([
        "webviewReady",
        "frontendLog",
        "getSelection",
        "getProviders",
        "getRelated",
        "getApiKeys",
        "getConfigurationTemplates",
        "getConfigurationBackups",
        "getProviderCapabilities",
        "getSavedWikis",
        "checkReadmeBackupState",
        "getProviderConfigs",
      ]);
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
    try {
      await this.initPromise;
    } catch (e) {
      this.logger.error("Initialization failed before command execution", {
        command,
        error: e,
      });
    }

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
