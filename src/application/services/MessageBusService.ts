import type { Webview } from "vscode";
import { OutboundEvents } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes } from "../../constants/ErrorCodes";
import { ServiceLimits } from "../../constants";
import { WebviewOptimizerService } from "../../infrastructure/services/WebviewOptimizerService";
import { DebouncingService } from "../../infrastructure/services/DebouncingService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class MessageBusService {
  private optimizer: WebviewOptimizerService;
  private debouncingService: DebouncingService;
  private debouncedPostMessage: any;
  private debouncedEnvironmentStatus: any;
  private logger: Logger;

  constructor(
    webview: Webview,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("MessageBusService", loggingService);
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
    try {
      const size = payload ? JSON.stringify(payload).length : 0;
      this.logger.debug(`Queueing message to webview - command=${command}, size=${size}`);
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
      this.logger.debug(`Posting immediate message to webview - command=${command}, size=${size}`);
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
    this.logger.debug(`postSuccess called for command=${command}`);
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
