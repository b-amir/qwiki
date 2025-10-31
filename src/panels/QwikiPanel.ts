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
import { MessageBus } from "../application/services/MessageBus";

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
  private messageBus: MessageBus | undefined;
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

  constructor(
    extensionUri: Uri,
    private ctx: ExtensionContext,
  ) {
    this._extensionUri = extensionUri;
    this.bootstrap = new AppBootstrap(ctx);
    this._initPromise = this.initializeAsync();
    this._broadcastEnvironmentStatus();
    this._startLanguageMonitoring();
  }

  private async initializeAsync(): Promise<void> {
    try {
      await this.bootstrap.initialize();
      console.log("[QWIKI] QwikiPanel: bootstrap.initialize completed successfully");
    } catch (e) {
      console.error("[QWIKI] QwikiPanel: bootstrap.initialize failed:", e);
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
      console.log("[QWIKI] QwikiPanel: initializeEventHandlers completed successfully");
    } catch (e) {
      console.error("[QWIKI] QwikiPanel: initializeEventHandlers failed:", e);
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
      console.log("[QWIKI] QwikiPanel: errorHandler retrieved successfully");
    } catch (e) {
      console.error("[QWIKI] QwikiPanel: getErrorHandler failed:", e);
      this.errorHandler = {
        handle: (error: any, context?: any) => {
          console.error("[QWIKI] Fallback error handler:", error, context);
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
    this._setWebviewMessageListener(webviewView.webview);
    this.messageBus = new MessageBus(webviewView.webview);
    this.bootstrap
      .createCommandRegistry(webviewView.webview)
      .then((registry) => {
        this.commandRegistry = registry;
        console.log("[QWIKI] QwikiPanel: createCommandRegistry completed successfully");
      })
      .catch((e) => {
        console.error("[QWIKI] QwikiPanel: createCommandRegistry failed:", e);
        this.createFallbackCommandRegistry(webviewView.webview);
      });
    webviewView.onDidDispose(() => this.dispose(), null, this._disposables);
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

  public dispose() {
    this.view = undefined;
    this._webviewReady = false;
    this._clearLanguageStatusInterval();

    if (this.messageBus) {
      this.messageBus.dispose();
      this.messageBus = undefined;
    }

    this.commandRegistry?.dispose?.();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
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
      console.error("[QWIKI] QwikiPanel: Failed to determine language server status:", error);
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
    if (!this._webviewReady || !this.view?.webview) {
      return;
    }
    try {
      this.messageBus?.postMessage(Outbound.environmentStatus, payload);
    } catch (error) {
      console.error("[QWIKI] QwikiPanel: Failed to post environment status:", error);
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
          console.log(`[QWIKI] QwikiPanel: Received webview message - command=${command}`);
          switch (command) {
            case "frontendLog": {
              try {
                const msg = payload?.message ?? "";
                const data = payload?.data;
                if (data !== undefined) {
                  console.log(`[QWIKI] Frontend: ${msg}`, data);
                } else {
                  console.log(`[QWIKI] Frontend: ${msg}`);
                }
              } catch (e) {
                console.log(`[QWIKI] Frontend: <log formatting error>`);
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
                  console.error(
                    "[QWIKI] QwikiPanel: Exception in _setWebviewMessageListener:",
                    error,
                  );
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
                await this._initPromise.catch((e) => {
                  console.error("[QWIKI] Initialization failed before command execution:", e);
                });
                await this.commandRegistry.execute(command, payload);
                const doneTs = Date.now();
                console.log(
                  `[QWIKI] QwikiPanel: Executed command from webview - command=${command}, duration=${doneTs - receiveTs}ms`,
                );
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
    console.warn(
      "[QWIKI] QwikiPanel: Creating fallback command registry with limited functionality",
    );

    const fallbackRegistry = new CommandRegistry();

    const originalExecute = fallbackRegistry.execute.bind(fallbackRegistry);
    const originalRegister = fallbackRegistry.register.bind(fallbackRegistry);

    fallbackRegistry.execute = async <T>(name: string, payload: T): Promise<void> => {
      console.warn(
        `[QWIKI] Fallback command registry: Attempting to execute command "${name}" - initialization may have failed`,
      );
      try {
        return await originalExecute(name, payload);
      } catch (error) {
        console.error(`[QWIKI] Fallback command registry: Command "${name}" failed:`, error);
        throw new Error(
          `Command "${name}" cannot be executed due to initialization failure: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    fallbackRegistry.register = <T>(name: string, command: any): void => {
      console.log(`[QWIKI] Fallback command registry: Registered command "${name}"`);
      return originalRegister(name, command);
    };

    this.commandRegistry = fallbackRegistry;
  }
}
