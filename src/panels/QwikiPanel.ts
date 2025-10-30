import { Disposable, WebviewView, Uri, window, ExtensionContext, commands, Webview } from "vscode";
import { AppBootstrap, CommandRegistry } from "../application";
import { getWebviewHtml } from "./webviewContent";
import { tryOpenFile } from "./fileOps";
import { Inbound, Outbound, Page, Pages } from "./constants";
import { WebviewPaths, VSCodeCommandIds, MessageStrings } from "../constants";
import { BaseError } from "../errors";
import type { ErrorHandler } from "../infrastructure/services/ErrorHandler";

type SelectionPayload = {
  text: string;
  languageId?: string;
  filePath?: string;
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

  constructor(
    extensionUri: Uri,
    private ctx: ExtensionContext,
  ) {
    this._extensionUri = extensionUri;
    this.bootstrap = new AppBootstrap(ctx);
    this._initPromise = this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      await this.bootstrap.initialize();
      console.log("[QWIKI] QwikiPanel: bootstrap.initialize completed successfully");
    } catch (e) {
      console.error("[QWIKI] QwikiPanel: bootstrap.initialize failed:", e);
      return;
    }

    try {
      await this.bootstrap.initializeEventHandlers();
      console.log("[QWIKI] QwikiPanel: initializeEventHandlers completed successfully");
    } catch (e) {
      console.error("[QWIKI] QwikiPanel: initializeEventHandlers failed:", e);
      return;
    }

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

    try {
      webviewView.webview.postMessage({ command: Outbound.webviewReady, payload: { ready: true } });
      console.log("[QWIKI] QwikiPanel: webviewReady message sent successfully");
    } catch (error) {
      console.error("[QWIKI] QwikiPanel: Failed to send webviewReady message:", error);
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

  public dispose() {
    this.view = undefined;
    this._webviewReady = false;

    if (this.commandRegistry) {
      const messageBus = (this.commandRegistry as any).messageBus;
      if (messageBus && messageBus.dispose) {
        messageBus.dispose();
      }
    }

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
    this.view.webview.postMessage({
      command: Outbound.navigate,
      payload: { page: this._pendingPage },
    });
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
    this.view.webview.postMessage({ command: Outbound.selection, payload });
    if (autoGenerate) {
      this.view.webview.postMessage({ command: Outbound.triggerGenerate });
    }
    this._pendingSelection = undefined;
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
              this._webviewReady = true;
              this._flushPendingNavigation();
              this._flushPendingSelection();
              try {
                this.view?.webview.postMessage({
                  command: Outbound.webviewReady,
                  payload: { ready: true },
                });
              } catch (error) {
                console.error(
                  "[QWIKI] QwikiPanel: Exception in _setWebviewMessageListener:",
                  error,
                );
              }
              return;
            }
            case Inbound.openFile: {
              const { path, line } = payload as { path: string; line?: number };
              await tryOpenFile(path, line);
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
