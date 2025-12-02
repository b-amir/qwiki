import type { Webview } from "vscode";
import { Outbound, Page } from "@/panels/constants";
import { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

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
  private lastNavigationTime = 0;
  private readonly NAVIGATION_DEBOUNCE_MS = 100;
  private logger: Logger;

  constructor(
    private messageBus: MessageBusService | undefined,
    private view: { webview?: Webview } | undefined,
    loggingService?: LoggingService,
  ) {
    this.logger = createLogger("NavigationManager");
  }

  setWebviewReady(ready: boolean): void {
    this._webviewReady = ready;
    if (ready) {
      this.logger.debug("Webview ready, flushing pending navigation and selection", {
        hadPendingPage: !!this._pendingPage,
        hadPendingSelection: !!this._pendingSelection,
      });
      this.flushPendingNavigation();
      this.flushPendingSelection();
    }
  }

  queueNavigation(page: Page): void {
    const now = Date.now();

    this.logger.debug("queueNavigation called", { page, webviewReady: this._webviewReady });

    if (now - this.lastNavigationTime < this.NAVIGATION_DEBOUNCE_MS) {
      this.logger.debug("Navigation request debounced", {
        page,
        timeSinceLast: now - this.lastNavigationTime,
      });
      return;
    }

    if (this._pendingPage === page) {
      this.logger.debug("Navigation already queued for page", { page });
      return;
    }

    this.lastNavigationTime = now;
    this._pendingPage = page;
    this.flushPendingNavigation();
  }

  flushPendingNavigation(): void {
    if (!this._pendingPage || !this._webviewReady || !this.view?.webview) {
      return;
    }
    this.logger.debug("Flushing navigation", { page: this._pendingPage });
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

  hasPendingNavigation(): boolean {
    return !!this._pendingPage;
  }
}
