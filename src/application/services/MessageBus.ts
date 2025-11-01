import type { Webview } from "vscode";
import { OutboundEvents } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes } from "../../constants/ErrorCodes";
import { WebviewOptimizer } from "../../infrastructure/services/WebviewOptimizer";
import { DebouncingService } from "../../infrastructure/services/DebouncingService";
import { LoggingService } from "../../infrastructure/services/LoggingService";

export class MessageBus {
  private optimizer: WebviewOptimizer;
  private debouncingService: DebouncingService;
  private debouncedPostMessage: any;
  private debouncedEnvironmentStatus: any;
  private readonly serviceName = "MessageBus";

  constructor(
    webview: Webview,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.optimizer = new WebviewOptimizer(webview, this.loggingService);
    this.debouncingService = new DebouncingService();
    this.debouncedPostMessage = this.debouncingService.debounce(
      (command: string, payload?: any) => {
        this.optimizer.postMessage(command, payload);
      },
      50,
      { leading: false, trailing: true },
    );
    this.debouncedEnvironmentStatus = this.debouncingService.debounce(
      (command: string, payload?: any) => {
        this.optimizer.postMessage(command, payload);
      },
      200,
      { leading: false, trailing: true },
    );
  }

  postMessage(command: string, payload?: any): void {
    try {
      const size = payload ? JSON.stringify(payload).length : 0;
      this.loggingService.debug(
        this.serviceName,
        `Queueing message to webview - command=${command}, size=${size}`,
      );
    } catch {}
    if (command === "environmentStatus") {
      this.debouncedEnvironmentStatus(command, payload);
    } else {
      this.optimizer.postMessage(command, payload);
    }
  }

  postImmediate(command: string, payload?: any): void {
    try {
      const size = payload ? JSON.stringify(payload).length : 0;
      this.loggingService.debug(
        this.serviceName,
        `Posting immediate message to webview - command=${command}, size=${size}`,
      );
    } catch {}
    this.optimizer.postImmediate(command, payload);
  }

  postError(
    message: string,
    code: string = ErrorCodes.unknown,
    suggestion?: string,
    context?: any,
    originalError?: string,
  ): void {
    this.loggingService.error(
      this.serviceName,
      "Error posted to frontend",
      {
        code,
        message,
        suggestion,
        context,
        originalError,
        timestamp: new Date().toISOString(),
      },
    );

    this.postImmediate(OutboundEvents.error, {
      code,
      message,
      suggestion,
      originalError,
      timestamp: new Date().toISOString(),
      context: context ? JSON.stringify(context).substring(0, 500) : undefined,
    });
  }

  postSuccess(command: string, payload?: any): void {
    this.loggingService.debug(
      this.serviceName,
      `postSuccess called for command=${command}`,
    );
    if (command === "environmentStatus") {
      this.debouncedEnvironmentStatus(command, payload);
    } else {
      this.postMessage(command, payload);
    }
  }

  postLoadingStep(step: LoadingStep): void {
    this.postMessage(OutboundEvents.loadingStep, { step });
  }

  dispose(): void {
    this.debouncingService.cancelAll();
    this.optimizer.dispose();
  }
}
