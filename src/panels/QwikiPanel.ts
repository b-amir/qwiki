import { Disposable, WebviewView, Uri, window, ExtensionContext, commands } from "vscode";
import { AppBootstrap } from "../application";
import { getWebviewHtml } from "./webviewContent";
import { tryOpenFile } from "./fileOps";
import { Inbound, Outbound, Page, Pages } from "./constants";
import { WebviewPaths } from "../constants";
import { VSCodeCommandIds } from "../constants";

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
  private commandRegistry: any;

  constructor(
    extensionUri: Uri,
    private ctx: ExtensionContext,
  ) {
    this._extensionUri = extensionUri;
    this.bootstrap = new AppBootstrap(ctx);
    this.bootstrap.initializeEventHandlers();
  }

  public resolveWebviewView(webviewView: WebviewView) {
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
    this.commandRegistry = this.bootstrap.createCommandRegistry(webviewView.webview);
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
      window.showInformationMessage("Please open a file to create wiki documentation");
      return;
    }
    if (!payload.text.trim()) {
      window.showInformationMessage("Please select some code to build documentation for");
      return;
    }
    this._queueSelection(payload, { autoGenerate: true });
    this.showPage(Pages.wiki);
    this._flushPendingSelection();
  }

  public dispose() {
    this.view = undefined;
    this._webviewReady = false;
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

  private _setWebviewMessageListener(webview: any) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        try {
          const command = message.command as string;
          const payload = message.payload;

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
              if (this.commandRegistry.has(command)) {
                await this.commandRegistry.execute(command, payload);
              }
              return;
            }
          }
        } catch (err: any) {
          webview.postMessage({
            command: Outbound.error,
            payload: { message: err?.message || String(err) },
          });
        }
      },
      undefined,
      this._disposables,
    );
  }
}
