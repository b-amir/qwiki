import type { Webview } from "vscode";
import { Outbound, Page } from "./constants";
import { MessageBusService } from "../application/services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";

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
  private logger: Logger;

  constructor(
    private messageBus: MessageBusService | undefined,
    private view: { webview?: Webview } | undefined,
    loggingService?: LoggingService,
  ) {
    this.logger = createLogger(
      "NavigationManager",
      loggingService ||
        new LoggingService({
          enabled: false,
          level: "error",
          includeTimestamp: true,
          includeService: true,
        }),
    );
  }

  setWebviewReady(ready: boolean): void {
    this.logger.info("setWebviewReady called", { ready, hadPendingPage: !!this._pendingPage });
    this._webviewReady = ready;
    if (ready) {
      this.flushPendingNavigation();
    }
  }

  queueNavigation(page: Page): void {
    this.logger.info("queueNavigation called", { page, webviewReady: this._webviewReady });
    this._pendingPage = page;
    this.flushPendingNavigation();
  }

  flushPendingNavigation(): void {
    this.logger.debug("flushPendingNavigation called", {
      hasPendingPage: !!this._pendingPage,
      pendingPage: this._pendingPage,
      webviewReady: this._webviewReady,
      hasWebview: !!this.view?.webview,
      hasMessageBus: !!this.messageBus,
    });
    if (!this._pendingPage || !this._webviewReady || !this.view?.webview) {
      if (!this._pendingPage) {
        this.logger.debug("No pending page to flush");
      } else if (!this._webviewReady) {
        this.logger.debug("Webview not ready, cannot flush navigation");
      } else if (!this.view?.webview) {
        this.logger.debug("No webview available, cannot flush navigation");
      }
      return;
    }
    this.logger.info("Flushing navigation", { page: this._pendingPage });
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
