import type { Webview } from "vscode";
import { Outbound, Page } from "./constants";
import { MessageBusService } from "../application/services/MessageBusService";

export type SelectionPayload = {
  text: string;
  languageId?: string;
  filePath?: string;
};

export class NavigationManager {
  private _pendingPage: Page | undefined;
  private _pendingSelection: { payload: SelectionPayload; autoGenerate: boolean } | undefined;
  private _lastSelection: SelectionPayload | undefined;
  private _webviewReady = false;

  constructor(
    private messageBus: MessageBusService | undefined,
    private view: { webview?: Webview } | undefined,
  ) {}

  setWebviewReady(ready: boolean): void {
    this._webviewReady = ready;
  }

  queueNavigation(page: Page): void {
    this._pendingPage = page;
    this.flushPendingNavigation();
  }

  flushPendingNavigation(): void {
    if (!this._pendingPage || !this._webviewReady || !this.view?.webview) {
      return;
    }
    this.messageBus?.postMessage(Outbound.navigate, { page: this._pendingPage });
    this._pendingPage = undefined;
  }

  queueSelection(payload: SelectionPayload, options?: { autoGenerate?: boolean }): void {
    this._lastSelection = payload;
    this._pendingSelection = { payload, autoGenerate: !!options?.autoGenerate };
    this.flushPendingSelection();
  }

  flushPendingSelection(): void {
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

  getLastSelection(): SelectionPayload | undefined {
    return this._lastSelection;
  }

  setLastSelection(selection: SelectionPayload | undefined): void {
    this._lastSelection = selection;
  }
}
