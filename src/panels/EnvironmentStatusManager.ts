import type { Webview } from "vscode";
import { Outbound } from "./constants";
import { MessageBusService } from "../application/services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import type { LanguageStatus } from "./LanguageStatusMonitor";

export interface ExtensionStatus {
  ready: boolean;
  message: string;
  reason?: string;
}

export interface EnvironmentStatusPayload {
  extension: ExtensionStatus;
  languageServer: LanguageStatus;
}

export class EnvironmentStatusManager {
  private logger: Logger;
  private _extensionStatus: ExtensionStatus = {
    ready: false,
    message: "Preparing Qwiki services...",
    reason: "initializing",
  };
  private _latestEnvironmentStatus: EnvironmentStatusPayload | undefined;
  private _lastBroadcastedStatus: string | undefined;

  constructor(
    private messageBus: MessageBusService | undefined,
    private view: { webview?: Webview } | undefined,
    private languageStatusMonitor: { getLanguageStatus: () => LanguageStatus },
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("EnvironmentStatusManager", loggingService);
  }

  setExtensionStatus(status: ExtensionStatus): void {
    this._extensionStatus = status;
    this.broadcastEnvironmentStatus();
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
      },
      languageServer: this.languageStatusMonitor.getLanguageStatus(),
    };
  }

  private postEnvironmentStatus(payload: EnvironmentStatusPayload): void {
    if (!this.view?.webview) {
      return;
    }
    try {
      this.messageBus?.postMessage(Outbound.environmentStatus, payload);
    } catch (error) {
      this.logger.error("Failed to post environment status", error);
    }
  }
}
