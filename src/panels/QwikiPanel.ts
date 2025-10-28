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

  constructor(
    extensionUri: Uri,
    private ctx: ExtensionContext,
  ) {
    this._extensionUri = extensionUri;
    this.bootstrap = new AppBootstrap(ctx);
    this.initializeAsync();
  }

  private async initializeAsync() {
    await this.bootstrap.initialize();
    await this.bootstrap.initializeEventHandlers();
    this.errorHandler = this.bootstrap.getErrorHandler() as ErrorHandler;
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
    this.commandRegistry = await this.bootstrap.createCommandRegistry(webviewView.webview);
    this._setWebviewMessageListener(webviewView.webview);
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
          switch (command) {
            case Inbound.webviewReady: {
              this._webviewReady = true;
              this._flushPendingNavigation();
              this._flushPendingSelection();
              return;
            }
            case Inbound.openFile: {
              const { path, line } = payload as { path: string; line?: number };
              await tryOpenFile(path, line);
              return;
            }
            default: {
              if (this.commandRegistry?.has(command)) {
                await this.commandRegistry.execute(command, payload);
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
}
