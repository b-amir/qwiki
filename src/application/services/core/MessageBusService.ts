import type { Webview } from "vscode";
import { OutboundEvents } from "@/constants/Events";
import type { LoadingStep } from "@/constants/Events";
import { ErrorCodes } from "@/constants/ErrorCodes";
import { ServiceLimits } from "@/constants";
import { WebviewOptimizerService } from "@/infrastructure/services/optimization/WebviewOptimizerService";
import {
  DebouncingService,
  type DebouncedFunction,
} from "@/infrastructure/services/optimization/DebouncingService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { ErrorContextBuilder } from "@/infrastructure/services/error/ErrorContextBuilder";

type MessagePayload = Record<string, unknown> | undefined;
type PostMessageFn = (command: string, payload?: MessagePayload) => void;

export class MessageBusService {
  private optimizer: WebviewOptimizerService;
  private debouncingService: DebouncingService;
  private debouncedPostMessage: DebouncedFunction<PostMessageFn>;
  private debouncedEnvironmentStatus: DebouncedFunction<PostMessageFn>;
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
      (command: string, payload?: MessagePayload) => {
        this.optimizer.postMessage(command, payload);
      },
      ServiceLimits.messageBusDebounceDelay,
      { leading: false, trailing: true },
    );
    this.debouncedEnvironmentStatus = this.debouncingService.debounce(
      (command: string, payload?: MessagePayload) => {
        this.optimizer.postMessage(command, payload);
      },
      ServiceLimits.environmentStatusDebounceDelay,
      { leading: false, trailing: true },
    );
  }

  postMessage(
    command: string,
    payload?: MessagePayload,
    priority: "immediate" | "high" | "normal" | "low" = "normal",
  ): void {
    if (command === "navigate") {
      this.logger.info("postMessage: navigate", { page: payload?.page });
    }
    if (command === "environmentStatus") {
      this.debouncedEnvironmentStatus(command, payload);
    } else {
      this.optimizer.postMessage(command, payload, priority);
    }
  }

  postImmediate(command: string, payload?: MessagePayload): void {
    this.optimizer.postImmediate(command, payload);
  }

  postError(
    message: string,
    code: string = ErrorCodes.unknown,
    suggestion?: string,
    context?: Record<string, unknown>,
    originalError?: string | Error,
  ): void {
    const error =
      originalError instanceof Error
        ? originalError
        : originalError
          ? new Error(originalError)
          : new Error(message);

    const operation = (context?.operation as string) || "unknown";

    const errorContext = ErrorContextBuilder.build(operation, error, {
      ...context,
      code,
      originalMessage: message,
    });

    const suggestions = suggestion
      ? [suggestion, ...errorContext.suggestions]
      : errorContext.suggestions;

    this.logger.error("Error posted to frontend", {
      code,
      message: errorContext.userMessage,
      suggestions,
      context: errorContext.data,
      originalError: originalError instanceof Error ? originalError.message : originalError,
      timestamp: new Date(errorContext.timestamp).toISOString(),
    });

    this.postImmediate(OutboundEvents.error, {
      code,
      message: errorContext.userMessage,
      suggestions,
      timestamp: new Date(errorContext.timestamp).toISOString(),
      context: errorContext.data
        ? JSON.stringify(errorContext.data).substring(0, ServiceLimits.errorContextMaxLength)
        : undefined,
      originalError: originalError instanceof Error ? originalError.message : originalError,
    });
  }

  postSuccess(command: string, payload?: MessagePayload): void {
    if (command === "environmentStatus") {
      this.debouncedEnvironmentStatus(command, payload);
    } else if (command === OutboundEvents.loadingStep) {
      this.postImmediate(command, payload);
    } else {
      this.postMessage(command, payload);
    }
  }

  postLoadingStep(step: LoadingStep): void {
    this.postMessage(OutboundEvents.loadingStep, { step }, "high");
  }

  postChunk(chunk: string, accumulatedContent: string): void {
    this.chunkBuffer.push({ chunk, accumulatedContent });

    if (this.chunkBuffer.length >= 2) {
      this.flushChunksImmediately();
    } else if (!this.chunkTimer) {
      this.chunkTimer = setTimeout(() => {
        this.flushChunks();
      }, 50);
    }
  }

  flushChunksImmediately(): void {
    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer);
      this.chunkTimer = undefined;
    }
    this.flushChunks();
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

    this.optimizer.postImmediate(OutboundEvents.wikiContentChunk, payload);
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
