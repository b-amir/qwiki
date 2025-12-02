import type { Webview } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

type MessagePriority = "immediate" | "high" | "normal" | "low";
type MessagePayload = Record<string, unknown> | undefined;

interface QueuedMessage {
  command: string;
  payload?: MessagePayload;
  timestamp: number;
  id: string;
  priority: MessagePriority;
}

interface WebviewMessage {
  command: string;
  payload?: MessagePayload | { messages: QueuedMessage[] };
}

export class WebviewOptimizerService {
  private messageQueue: QueuedMessage[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms batch delay
  private readonly LOW_PRIORITY_BATCH_DELAY = 200; // 200ms for low priority
  private readonly MAX_BATCH_SIZE = 20; // Changed from 10
  private messageId = 0;
  private lastEnvironmentStatusPayload: string | undefined;
  private lastNavigationPayload: string | undefined;
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

  postMessage(
    command: string,
    payload?: MessagePayload,
    priority: MessagePriority = "normal",
  ): void {
    if (priority === "immediate") {
      this.flushQueue();
      this.safePostMessage({ command, payload });
      return;
    }

    if (command === "environmentStatus") {
      const payloadHash = JSON.stringify(payload);
      if (this.lastEnvironmentStatusPayload === payloadHash) {
        return;
      }
      this.lastEnvironmentStatusPayload = payloadHash;
    }

    if (command === "navigate") {
      const payloadHash = JSON.stringify(payload);
      if (this.lastNavigationPayload === payloadHash) {
        this.logDebug("Deduplicating duplicate navigation command");
        return;
      }
      this.lastNavigationPayload = payloadHash;
    }

    const message: QueuedMessage = {
      command,
      payload,
      timestamp: Date.now(),
      id: this.generateMessageId(),
      priority,
    };

    this.messageQueue.push(message);
    this.scheduleBatch(priority);
  }

  postImmediate(command: string, payload?: MessagePayload): void {
    this.flushQueue();
    this.safePostMessage({ command, payload });
  }

  private scheduleBatch(priority: MessagePriority = "normal"): void {
    if (this.batchTimeout) {
      return;
    }

    const delay = priority === "low" ? this.LOW_PRIORITY_BATCH_DELAY : this.BATCH_DELAY;

    this.batchTimeout = setTimeout(() => {
      this.flushQueue();
    }, delay);
  }

  private flushQueue(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.messageQueue.length === 0) {
      return;
    }

    this.messageQueue.sort((a, b) => {
      const priorityOrder: Record<MessagePriority, number> = {
        immediate: 0,
        high: 1,
        normal: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const deduplicatedQueue = this.deduplicateMessages([...this.messageQueue]);
    this.messageQueue = [];
    const batch = deduplicatedQueue.splice(0, this.MAX_BATCH_SIZE);
    this.messageQueue = deduplicatedQueue;

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

    if (deduplicatedQueue.length > 0) {
      const nextPriority = deduplicatedQueue[0]?.priority || "normal";
      this.scheduleBatch(nextPriority);
    }
  }

  private safePostMessage(message: WebviewMessage): void {
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

  private deduplicateMessages(messages: QueuedMessage[]): QueuedMessage[] {
    const loadingSteps = new Map<string, QueuedMessage>();
    const navigations = new Map<string, QueuedMessage>();
    const deduplicated: QueuedMessage[] = [];

    for (const msg of messages) {
      if (msg.command === "loadingStep" && msg.payload) {
        const context = (msg.payload as { context?: string }).context;
        if (context) {
          const key = `loadingStep:${context}`;
          const existing = loadingSteps.get(key);

          if (!existing || this.isNewerStep(msg, existing)) {
            loadingSteps.set(key, msg);
          }
          continue;
        }
      }

      if (msg.command === "navigate") {
        const payloadHash = JSON.stringify(msg.payload);
        const existing = navigations.get("navigate");

        if (!existing || msg.timestamp > existing.timestamp) {
          navigations.set("navigate", msg);
        }
        continue;
      }

      deduplicated.push(msg);
    }

    for (const step of loadingSteps.values()) {
      deduplicated.push(step);
    }

    for (const nav of navigations.values()) {
      deduplicated.push(nav);
    }

    return deduplicated.sort((a, b) => a.timestamp - b.timestamp);
  }

  private isNewerStep(msg1: QueuedMessage, msg2: QueuedMessage): boolean {
    const seq1 = (msg1.payload as { sequence?: number })?.sequence ?? 0;
    const seq2 = (msg2.payload as { sequence?: number })?.sequence ?? 0;

    if (seq1 !== seq2) {
      return seq1 > seq2;
    }

    return msg1.timestamp > msg2.timestamp;
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
    this.lastNavigationPayload = undefined;
    this.flushQueue();
  }
}

export class Debouncer {
  private timeout: NodeJS.Timeout | null = null;

  constructor(private delay: number) {}

  debounce<T extends (...args: unknown[]) => void>(fn: T): T {
    return ((...args: unknown[]) => {
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
