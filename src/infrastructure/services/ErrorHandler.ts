import type { BaseError } from "../../errors";
import type { EventBus } from "../../events";
import { ErrorEvents } from "../../constants/Events";

export interface ErrorHandler {
  handle(error: Error | BaseError, context?: Record<string, any>): Promise<void>;
  registerGlobalHandlers(): void;
}

export class ErrorHandlerImpl implements ErrorHandler {
  constructor(private eventBus: EventBus) {}

  async handle(error: Error | BaseError, context?: Record<string, any>): Promise<void> {
    const errorInfo = this.normalizeError(error, context);

    await this.eventBus.publish(ErrorEvents.occurred, errorInfo);

    if (errorInfo.isRecoverable) {
      await this.eventBus.publish(ErrorEvents.recoveryAttempt, errorInfo);
    }
  }

  registerGlobalHandlers(): void {
    process.on("uncaughtException", async (error: Error) => {
      await this.handle(error, { source: "uncaughtException" });
    });

    process.on("unhandledRejection", async (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      await this.handle(error, { source: "unhandledRejection" });
    });
  }

  private normalizeError(error: Error | BaseError, context?: Record<string, any>) {
    const isBaseError = error && typeof error === "object" && "code" in error;

    return {
      name: error.name,
      message: error.message,
      code: isBaseError ? (error as BaseError).code : "unknown",
      timestamp: isBaseError ? (error as BaseError).timestamp : new Date(),
      stack: error.stack,
      context: {
        ...context,
        ...(isBaseError ? (error as BaseError).context : {}),
      },
      isRecoverable: this.isRecoverableError(error),
    };
  }

  private isRecoverableError(error: Error | BaseError): boolean {
    if (!error || typeof error !== "object") return false;

    const errorCode = (error as BaseError).code;
    const recoverableErrors = [
      "error.invalidSelection",
      "error.missingSnippet",
      "error.missingProvider",
    ];

    return recoverableErrors.includes(errorCode);
  }
}
