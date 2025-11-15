import type { Webview } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

interface QueuedMessage {
  command: string;
  payload?: any;
  timestamp: number;
  id: string;
}

export class WebviewOptimizerService {
  private messageQueue: QueuedMessage[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms batch delay
  private readonly MAX_BATCH_SIZE = 10;
  private messageId = 0;
  private lastEnvironmentStatusPayload: string | undefined;
  private logger: Logger;

  constructor(
    private webview: Webview,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("WebviewOptimizerService");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  postMessage(command: string, payload?: any): void {
    if (command === "environmentStatus") {
      const payloadHash = JSON.stringify(payload);
      if (this.lastEnvironmentStatusPayload === payloadHash) {
        return;
      }
      this.lastEnvironmentStatusPayload = payloadHash;
    }

    const message: QueuedMessage = {
      command,
      payload,
      timestamp: Date.now(),
      id: this.generateMessageId(),
    };

    this.messageQueue.push(message);
    this.scheduleBatch();
  }

  postImmediate(command: string, payload?: any): void {
    this.flushQueue();
    this.safePostMessage({ command, payload });
  }

  private scheduleBatch(): void {
    if (this.batchTimeout) {
      return;
    }

    this.batchTimeout = setTimeout(() => {
      this.flushQueue();
    }, this.BATCH_DELAY);
  }

  private flushQueue(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.messageQueue.length === 0) {
      return;
    }

    const batch = this.messageQueue.splice(0, this.MAX_BATCH_SIZE);

    if (batch.length === 1) {
      const message = batch[0];
      this.safePostMessage({ command: message.command, payload: message.payload });
    } else {
      try {
        const cmds = batch.map((m) => m.command).filter(Boolean);
        this.logDebug(`Flushing batch of ${batch.length} -> [${cmds.join(", ")}]`);
      } catch {}
      this.safePostMessage({
        command: "batch",
        payload: {
          messages: batch,
        },
      });
    }

    if (this.messageQueue.length > 0) {
      this.scheduleBatch();
    }
  }

  private safePostMessage(message: any): void {
    try {
      this.webview.postMessage(message);
      const command = message?.command ?? "unknown";
      const importantCommands = new Set([
        "error",
        "loadingStep",
        "generationCancelled",
        "environmentStatus",
      ]);
      if (importantCommands.has(command)) {
        try {
          const size = message?.payload ? JSON.stringify(message.payload).length : 0;
          this.logDebug(`Posted message - command=${command}, size=${size}`);
        } catch {}
      }
    } catch (error) {
      this.logError("Channel closed, message discarded:", {
        error: error instanceof Error ? error.message : String(error),
        message: message.command || "unknown",
        timestamp: new Date().toISOString(),
      });

      this.messageQueue = [];

      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
    }
  }

  private generateMessageId(): string {
    return `msg_${++this.messageId}_${Date.now()}`;
  }

  dispose(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.lastEnvironmentStatusPayload = undefined;
    this.flushQueue();
  }
}

export class Debouncer {
  private timeout: NodeJS.Timeout | null = null;

  constructor(private delay: number) {}

  debounce<T extends (...args: any[]) => void>(fn: T): T {
    return ((...args: any[]) => {
      if (this.timeout) {
        clearTimeout(this.timeout);
      }

      this.timeout = setTimeout(() => {
        fn(...args);
        this.timeout = null;
      }, this.delay);
    }) as T;
  }

  cancel(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  dispose(): void {
    this.cancel();
  }
}
