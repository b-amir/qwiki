import {
  Disposable,
  WebviewView,
  Uri,
  window,
  workspace,
  extensions,
  ExtensionContext,
  commands,
  Webview,
} from "vscode";
import { AppBootstrap, CommandRegistry } from "../application";
import { getWebviewHtml } from "./webviewContent";
import { tryOpenFile } from "./fileOps";
import { Inbound, Outbound, Page, Pages } from "./constants";
import { WebviewPaths, VSCodeCommandIds, MessageStrings } from "../constants";
import { BaseError } from "../errors";
import type { ErrorHandler } from "../infrastructure/services/ErrorHandler";
import { MessageBusService } from "../application/services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";

type SelectionPayload = {
  text: string;
  languageId?: string;
  filePath?: string;
};

type EnvironmentStatusPayload = {
  extension: {
    ready: boolean;
    message: string;
    reason?: string;
  };
  languageServer: {
    ready: boolean;
    languageId?: string;
    message: string;
    reason?: string;
    extensions?: string[];
  };
};

export class QwikiPanel {
  private readonly _extensionUri: Uri;
  private view?: WebviewView;
  private _webviewReady = false;
  private _pendingPage: Page | undefined;
  private _disposables: Disposable[] = [];
  private _pendingSelection: { payload: SelectionPayload; autoGenerate: boolean } | undefined;
  private _lastSelection: SelectionPayload | undefined;
  private bootstrap: AppBootstrap;
  private commandRegistry: CommandRegistry | undefined;
  private errorHandler: ErrorHandler | undefined;
  private _initPromise: Promise<void>;
  private messageBus: MessageBusService | undefined;
  private loggingService: LoggingService;
  private logger: Logger;
  private _extensionStatus = {
    ready: false,
    message: "Preparing Qwiki services...",
    reason: "initializing",
  };
  private _languageStatus: {
    ready: boolean;
    languageId?: string;
    message: string;
    reason?: string;
    extensions?: string[];
  } = {
    ready: true,
    message: "",
    reason: "unknown",
  };
  private _latestEnvironmentStatus: EnvironmentStatusPayload | undefined;
  private _languageStatusInterval: NodeJS.Timeout | undefined;
  private _lastBroadcastedStatus: string | undefined;
  private _lastCommandExecutionTime = new Map<string, number>();
  private readonly COMMAND_THROTTLE_DELAY = 1000; // 1 second throttle

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
      this.loggingService = new LoggingService({
        enabled: false,
        level: "error",
        includeTimestamp: true,
        includeService: true,
      });
    }
    this.logger = createLogger("QwikiPanel", this.loggingService);
    this._initPromise = this.initializeAsync();
    this._broadcastEnvironmentStatus();
    this._startLanguageMonitoring();
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
      await this.bootstrap.initialize();
      this.logInfo("bootstrap.initialize completed successfully");
    } catch (e) {
      this.logError("bootstrap.initialize failed", e);
      this._extensionStatus = {
        ready: false,
        message: "Failed to initialize Qwiki services.",
        reason: "error",
      };
      this._broadcastEnvironmentStatus();
      return;
    }

    try {
      await this.bootstrap.initializeEventHandlers();
      this.logInfo("initializeEventHandlers completed successfully");
    } catch (e) {
      this.logError("initializeEventHandlers failed", e);
      this._extensionStatus = {
        ready: false,
        message: "Failed to initialize Qwiki event handlers.",
        reason: "error",
      };
      this._broadcastEnvironmentStatus();
      return;
    }

    this._extensionStatus = {
      ready: true,
      message: "Qwiki services ready.",
      reason: "ready",
    };
    this._broadcastEnvironmentStatus();

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
  }

  public async resolveWebviewView(webviewView: WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, WebviewPaths.out),
        Uri.joinPath(this._extensionUri, WebviewPaths.webviewBuild),
      ],
    };

    this.view = webviewView;
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);
    this._webviewReady = false;
    this.messageBus = new MessageBusService(webviewView.webview, this.loggingService);
    this._setWebviewMessageListener(webviewView.webview);
    this._flushEnvironmentStatus();
    this.bootstrap
      .createCommandRegistry(webviewView.webview)
      .then((registry) => {
        this.commandRegistry = registry;
        this.logInfo("createCommandRegistry completed successfully");
        this._setupWikiWatcherListener();
      })
      .catch((e) => {
        this.logError("createCommandRegistry failed", e);
        this.createFallbackCommandRegistry(webviewView.webview);
      });
    webviewView.onDidDispose(
      () => {
        this.dispose().catch((error) => {
          this.logError("Error during disposal", error);
        });
      },
      null,
      this._disposables,
    );
  }

  private _setupWikiWatcherListener(): void {
    try {
      const eventBus = this.bootstrap.getContainer().resolve("eventBus") as any;
      if (eventBus && typeof eventBus.subscribe === "function") {
        const unsubscribe = eventBus.subscribe("savedWikisChanged", async () => {
          this.logDebug("savedWikisChanged event received, refreshing saved wikis");
          if (this.commandRegistry && this._webviewReady) {
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

  public showPage(page: Page) {
    this._queueNavigation(page);
    commands.executeCommand(VSCodeCommandIds.openPanelView);
    this.view?.show?.(true);
  }

  public createWikiFromEditorSelection() {
    const payload = this._readSelectionFromEditor(false);
    if (!payload) {
      window.showInformationMessage(MessageStrings.openFileToCreate);
      return;
    }
    if (!payload.text.trim()) {
      window.showInformationMessage(MessageStrings.selectCodeToBuild);
      return;
    }
    this._queueSelection(payload, { autoGenerate: true });
    this.showPage(Pages.wiki);
    this._flushPendingSelection();
  }

  public showSavedWikis() {
    this.showPage(Pages.savedWikis);
  }

  public async dispose(): Promise<void> {
    this._clearLanguageStatusInterval();

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
    this._webviewReady = false;
  }

  private _queueNavigation(page: Page) {
    this._pendingPage = page;
    this._flushPendingNavigation();
  }

  private _flushPendingNavigation() {
    if (!this._pendingPage || !this._webviewReady || !this.view?.webview) {
      return;
    }
    this.messageBus?.postMessage(Outbound.navigate, { page: this._pendingPage });
    this._pendingPage = undefined;
  }

  private _queueSelection(payload: SelectionPayload, options?: { autoGenerate?: boolean }) {
    this._lastSelection = payload;
    this._pendingSelection = { payload, autoGenerate: !!options?.autoGenerate };
    this._flushPendingSelection();
  }

  private _flushPendingSelection() {
    if (!this._pendingSelection || !this._webviewReady || !this.view?.webview) {
      return;
    }
    const { payload, autoGenerate } = this._pendingSelection;
    this.messageBus?.postMessage(Outbound.selection, payload);
    if (autoGenerate) {
      this.messageBus?.postMessage(Outbound.triggerGenerate);
    }
    this._pendingSelection = undefined;
  }

  private _startLanguageMonitoring() {
    const update = () => {
      void this._updateLanguageServerStatus();
    };

    this._disposables.push(
      window.onDidChangeActiveTextEditor(() => {
        update();
      }),
    );
    this._disposables.push(
      workspace.onDidOpenTextDocument(() => {
        update();
      }),
    );
    this._disposables.push(
      workspace.onDidCloseTextDocument(() => {
        update();
      }),
    );
    this._disposables.push(
      extensions.onDidChange(() => {
        update();
      }),
    );

    update();
  }

  private async _updateLanguageServerStatus(): Promise<void> {
    try {
      const editor = window.activeTextEditor;
      if (!editor) {
        const newStatus = {
          ready: true,
          languageId: undefined,
          message: "",
          reason: "no-active-editor",
        };
        if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
          this._languageStatus = newStatus;
          this._broadcastEnvironmentStatus();
        }
        this._clearLanguageStatusInterval();
        return;
      }

      const languageId = editor.document.languageId;
      const relevantExtensions = extensions.all.filter((ext) => {
        const activationEvents = (ext.packageJSON as any)?.activationEvents;
        if (!Array.isArray(activationEvents)) {
          return false;
        }
        return activationEvents.some((event: string) => event === `onLanguage:${languageId}`);
      });

      if (!relevantExtensions.length) {
        const newStatus = {
          ready: true,
          languageId,
          message: `No dedicated language extension detected for ${languageId}.`,
          reason: "no-language-extension",
        };
        if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
          this._languageStatus = newStatus;
          this._broadcastEnvironmentStatus();
        }
        this._clearLanguageStatusInterval();
        return;
      }

      const inactiveExtensions = relevantExtensions.filter((ext) => !ext.isActive);

      if (inactiveExtensions.length === 0) {
        const newStatus = {
          ready: true,
          languageId,
          message: `${languageId} language features ready.`,
          reason: "ready",
          extensions: relevantExtensions.map((ext) => ext.id),
        };
        if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
          this._languageStatus = newStatus;
          this._broadcastEnvironmentStatus();
        }
        this._clearLanguageStatusInterval();
        return;
      }

      const newStatus = {
        ready: false,
        languageId,
        message: `Waiting for ${languageId} language features to load...`,
        reason: "loading",
        extensions: relevantExtensions.map((ext) => ext.id),
      };
      if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
        this._languageStatus = newStatus;
        this._broadcastEnvironmentStatus();
      }
      this._scheduleLanguageStatusInterval();
    } catch (error) {
      this.logError("Failed to determine language server status", error);
      const newStatus = {
        ready: false,
        languageId: this._languageStatus.languageId,
        message: "Unable to check language server status.",
        reason: "error",
        extensions: this._languageStatus.extensions,
      };
      if (JSON.stringify(this._languageStatus) !== JSON.stringify(newStatus)) {
        this._languageStatus = newStatus;
        this._broadcastEnvironmentStatus();
      }
      this._scheduleLanguageStatusInterval();
    }
  }

  private _scheduleLanguageStatusInterval() {
    if (this._languageStatusInterval) {
      return;
    }
    this._languageStatusInterval = setInterval(() => {
      void this._updateLanguageServerStatus();
    }, 3000);
  }

  private _clearLanguageStatusInterval() {
    if (!this._languageStatusInterval) {
      return;
    }
    clearInterval(this._languageStatusInterval);
    this._languageStatusInterval = undefined;
  }

  private _composeEnvironmentStatus(): EnvironmentStatusPayload {
    return {
      extension: {
        ready: this._extensionStatus.ready,
        message: this._extensionStatus.message,
        reason: this._extensionStatus.reason,
      },
      languageServer: {
        ready: this._languageStatus.ready,
        languageId: this._languageStatus.languageId,
        message: this._languageStatus.message,
        reason: this._languageStatus.reason,
        extensions: this._languageStatus.extensions,
      },
    };
  }

  private _postEnvironmentStatus(payload: EnvironmentStatusPayload) {
    if (!this.view?.webview) {
      return;
    }
    try {
      this.messageBus?.postMessage(Outbound.environmentStatus, payload);
    } catch (error) {
      this.logError("Failed to post environment status", error);
    }
  }

  private _broadcastEnvironmentStatus() {
    const payload = this._composeEnvironmentStatus();
    const statusHash = JSON.stringify(payload);

    if (this._lastBroadcastedStatus === statusHash) {
      return;
    }

    this._latestEnvironmentStatus = payload;
    this._lastBroadcastedStatus = statusHash;
    this._postEnvironmentStatus(payload);
  }

  private _flushEnvironmentStatus() {
    const payload = this._composeEnvironmentStatus();
    this._latestEnvironmentStatus = payload;
    this._postEnvironmentStatus(payload);
  }

  private _readSelectionFromEditor(allowFallback = true): SelectionPayload | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return allowFallback ? this._lastSelection : undefined;
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

  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command as string;
        const payload = message.payload;

        try {
          const receiveTs = Date.now();
          this.logDebug(`Received webview message - command=${command}`);

          if (command === "getSavedWikis") {
            const lastTime = this._lastCommandExecutionTime.get(command) || 0;
            if (receiveTs - lastTime < this.COMMAND_THROTTLE_DELAY) {
              this.logDebug(
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
                const data = payload?.data;
                if (data !== undefined) {
                  this.logDebug(`Frontend: ${msg}`, data);
                } else {
                  this.logDebug(`Frontend: ${msg}`);
                }
              } catch (e) {
                this.logWarn("Frontend log formatting error");
              }
              return;
            }
            case Inbound.webviewReady: {
              const wasReady = this._webviewReady;
              this._webviewReady = true;
              this._flushPendingNavigation();
              this._flushPendingSelection();
              this._flushEnvironmentStatus();
              if (!wasReady) {
                try {
                  this.messageBus?.postSuccess(Outbound.webviewReady, { ready: true });
                } catch (error) {
                  this.logError("Exception in _setWebviewMessageListener", error);
                }
              }
              return;
            }
            case Inbound.openFile: {
              const { path, line } = payload as { path: string; line?: number };
              await tryOpenFile(path, line);
              return;
            }
            case Inbound.getEnvironmentStatus: {
              this._flushEnvironmentStatus();
              return;
            }
            default: {
              if (this.commandRegistry?.has(command)) {
                this.logDebug(`Command ${command} found in registry, executing...`);
                const initWaitStart = Date.now();
                this.logDebug("Waiting for initialization promise", { command });
                await this._initPromise.catch((e) => {
                  this.logError("Initialization failed before command execution", {
                    command,
                    duration: Date.now() - initWaitStart,
                    error: e,
                  });
                });
                this.logDebug("Initialization promise resolved/errored", {
                  command,
                  waitDuration: Date.now() - initWaitStart,
                });
                this.logDebug(`Executing command ${command} with payload`, {
                  command,
                  hasPayload: !!payload,
                });
                const executeStart = Date.now();
                this.logDebug("About to call commandRegistry.execute", {
                  command,
                  hasRegistry: !!this.commandRegistry,
                });
                try {
                  await this.commandRegistry.execute(command, payload);
                } catch (err: any) {
                  this.logError("Error in commandRegistry.execute", {
                    command,
                    error: err?.message,
                    stack: err?.stack,
                    duration: Date.now() - executeStart,
                  });
                  throw err;
                }
                const executeDuration = Date.now() - executeStart;
                const doneTs = Date.now();
                this.logInfo(
                  `Executed command from webview - command=${command}, duration=${doneTs - receiveTs}ms`,
                );
                this.logDebug("Command execution finished", {
                  command,
                  executeDuration,
                  totalDuration: doneTs - receiveTs,
                });
              } else {
                this.logWarn(`Command ${command} not found in registry`);
              }
              return;
            }
          }
        } catch (err: any) {
          this.errorHandler?.handle(err, { source: "webviewMessage", command });
        }
      },
      undefined,
      this._disposables,
    );
  }

  private createFallbackCommandRegistry(webview: Webview): void {
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
