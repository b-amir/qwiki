import type { Webview } from "vscode";
import { OutboundEvents } from "@/constants/Events";
import type { LoadingStep } from "@/constants/Events";
import { ErrorCodes } from "@/constants/ErrorCodes";
import { ServiceLimits } from "@/constants";
import { WebviewOptimizerService } from "@/infrastructure/services/optimization/WebviewOptimizerService";
import { DebouncingService } from "@/infrastructure/services/optimization/DebouncingService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class MessageBusService {
  private optimizer: WebviewOptimizerService;
  private debouncingService: DebouncingService;
  private debouncedPostMessage: any;
  private debouncedEnvironmentStatus: any;
  private chunkBuffer: Array<{ chunk: string; accumulatedContent: string }> = [];
  private chunkTimer?: NodeJS.Timeout;
  private readonly CHUNK_BATCH_DELAY = 50;
  private readonly LARGE_PAYLOAD_THRESHOLD = 10 * 1024;
  private logger: Logger;

  constructor(
    webview: Webview,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("MessageBusService");
    this.optimizer = new WebviewOptimizerService(webview, this.loggingService);
    this.debouncingService = new DebouncingService();
    this.debouncedPostMessage = this.debouncingService.debounce(
      (command: string, payload?: any) => {
        this.optimizer.postMessage(command, payload);
      },
      ServiceLimits.messageBusDebounceDelay,
      { leading: false, trailing: true },
    );
    this.debouncedEnvironmentStatus = this.debouncingService.debounce(
      (command: string, payload?: any) => {
        this.optimizer.postMessage(command, payload);
      },
      ServiceLimits.environmentStatusDebounceDelay,
      { leading: false, trailing: true },
    );
  }

  postMessage(command: string, payload?: any): void {
    if (command === "navigate") {
      this.logger.info("postMessage: navigate", { page: payload?.page });
    }
    if (command === "environmentStatus") {
      this.debouncedEnvironmentStatus(command, payload);
    } else {
      this.optimizer.postMessage(command, payload);
    }
  }

  postImmediate(command: string, payload?: any): void {
    this.optimizer.postImmediate(command, payload);
  }

  postError(
    message: string,
    code: string = ErrorCodes.unknown,
    suggestion?: string,
    context?: any,
    originalError?: string,
  ): void {
    const suggestions = suggestion ? [suggestion] : undefined;

    this.logger.error("Error posted to frontend", {
      code,
      message,
      suggestion,
      suggestions,
      context,
      originalError,
      timestamp: new Date().toISOString(),
    });

    this.postImmediate(OutboundEvents.error, {
      code,
      message,
      suggestions,
      suggestion,
      originalError,
      timestamp: new Date().toISOString(),
      context: context
        ? JSON.stringify(context).substring(0, ServiceLimits.errorContextMaxLength)
        : undefined,
    });
  }

  postSuccess(command: string, payload?: any): void {
    if (command === "environmentStatus") {
      this.debouncedEnvironmentStatus(command, payload);
    } else {
      this.postMessage(command, payload);
    }
  }

  postLoadingStep(step: LoadingStep): void {
    this.postMessage(OutboundEvents.loadingStep, { step });
  }

  postChunk(chunk: string, accumulatedContent: string): void {
    this.chunkBuffer.push({ chunk, accumulatedContent });

    if (!this.chunkTimer) {
      this.chunkTimer = setTimeout(() => {
        this.flushChunks();
      }, this.CHUNK_BATCH_DELAY);
    }
  }

  private flushChunks(): void {
    if (this.chunkBuffer.length === 0) {
      this.chunkTimer = undefined;
      return;
    }

    const chunks = this.chunkBuffer.splice(0);
    this.chunkTimer = undefined;

    const lastChunk = chunks[chunks.length - 1];
    const payload = {
      chunks: chunks.map((c) => c.chunk),
      accumulatedContent: lastChunk.accumulatedContent,
    };

    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > this.LARGE_PAYLOAD_THRESHOLD) {
      this.logger.debug("Large chunk payload detected, sending optimized batch", {
        size: payloadSize,
        chunkCount: chunks.length,
      });
    }

    this.optimizer.postMessage(OutboundEvents.wikiContentChunk, payload);
  }

  dispose(): void {
    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer);
      this.chunkTimer = undefined;
    }
    this.flushChunks();
    this.debouncingService.cancelAll();
    this.optimizer.dispose();
  }
}
