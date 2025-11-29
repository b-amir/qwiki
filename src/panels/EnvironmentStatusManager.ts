import type { Webview } from "vscode";
import { Outbound } from "@/panels/constants";
import { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import type { LanguageStatus } from "@/panels/LanguageStatusMonitor";

export interface ExtensionStatus {
  ready: boolean;
  message: string;
  reason?: string;
  initializationProgress?: number;
}

export interface EnvironmentStatusPayload {
  extension: ExtensionStatus;
  languageServer: LanguageStatus;
}

export class EnvironmentStatusManager {
  private logger: Logger;
  private _extensionStatus: ExtensionStatus = {
    ready: false,
    message: "Preparing services",
    reason: "initializing",
    initializationProgress: 0,
  };
  private _latestEnvironmentStatus: EnvironmentStatusPayload | undefined;
  private _lastBroadcastedStatus: string | undefined;

  constructor(
    private messageBus: MessageBusService | undefined,
    private view: { webview?: Webview } | undefined,
    private languageStatusMonitor: { getLanguageStatus: () => LanguageStatus },
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("EnvironmentStatusManager");
  }

  /**
   * Update initialization progress (0-100)
   */
  setInitializationProgress(progress: number): void {
    this._extensionStatus.initializationProgress = progress;
    this.broadcastEnvironmentStatus();
  }

  setExtensionStatus(status: ExtensionStatus): void {
    this.logger.info("setExtensionStatus called", {
      ready: status.ready,
      message: status.message,
      reason: status.reason,
    });
    this._extensionStatus = status;
    if (status.ready) {
      this.flushEnvironmentStatus();
    } else {
      this.broadcastEnvironmentStatus();
    }
  }

  broadcastEnvironmentStatus(): void {
    const payload = this.composeEnvironmentStatus();
    const statusHash = JSON.stringify(payload);

    if (this._lastBroadcastedStatus === statusHash) {
      return;
    }

    this._latestEnvironmentStatus = payload;
    this._lastBroadcastedStatus = statusHash;
    this.postEnvironmentStatus(payload);
  }

  flushEnvironmentStatus(): void {
    const payload = this.composeEnvironmentStatus();
    this._latestEnvironmentStatus = payload;
    this.postEnvironmentStatus(payload);
  }

  getLatestEnvironmentStatus(): EnvironmentStatusPayload | undefined {
    return this._latestEnvironmentStatus;
  }

  private composeEnvironmentStatus(): EnvironmentStatusPayload {
    return {
      extension: {
        ready: this._extensionStatus.ready,
        message: this._extensionStatus.message,
        reason: this._extensionStatus.reason,
        initializationProgress: this._extensionStatus.initializationProgress,
      },
      languageServer: this.languageStatusMonitor.getLanguageStatus(),
    };
  }

  private postEnvironmentStatus(payload: EnvironmentStatusPayload): void {
    if (!this.view?.webview) {
      this.logger.warn("Cannot post environment status - no webview available");
      return;
    }
    try {
      this.logger.info("Posting environment status", {
        extensionReady: payload.extension.ready,
        extensionMessage: payload.extension.message,
        languageServerReady: payload.languageServer.ready,
        hasMessageBus: !!this.messageBus,
      });
      this.messageBus?.postImmediate(Outbound.environmentStatus, payload);
    } catch (error) {
      this.logger.error("Failed to post environment status", error);
    }
  }
}
