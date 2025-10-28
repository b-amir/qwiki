import type { Webview } from "vscode";

interface QueuedMessage {
  command: string;
  payload?: any;
  timestamp: number;
  id: string;
}

export class WebviewOptimizer {
  private messageQueue: QueuedMessage[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms batch delay
  private readonly MAX_BATCH_SIZE = 10;
  private messageId = 0;

  constructor(private webview: Webview) {}

  postMessage(command: string, payload?: any): void {
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
    this.webview.postMessage({ command, payload });
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
      this.webview.postMessage({ command: message.command, payload: message.payload });
    } else {
      this.webview.postMessage({
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

  private generateMessageId(): string {
    return `msg_${++this.messageId}_${Date.now()}`;
  }

  dispose(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
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