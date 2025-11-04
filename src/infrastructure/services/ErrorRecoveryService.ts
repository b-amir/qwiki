import { ProviderError, ErrorCodes, type ErrorCode, getErrorMessage } from "../../errors";
import { EventBus } from "../../events/EventBus";
import { MemoryOptimizationService } from "./MemoryOptimizationService";
import { ServiceLimits } from "../../constants";
import { LoggingService, createLogger, type Logger } from "./LoggingService";
import { createRetryStrategies, type RetryStrategy } from "./ErrorRecoveryStrategies";

interface RetryContext {
  attempt: number;
  maxAttempts: number;
  delay: number;
  error: ProviderError;
  providerId: string;
}

export class ErrorRecoveryService {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly JITTER_FACTOR = 0.1;
  private eventBus?: EventBus;
  private memoryOptimizationService?: MemoryOptimizationService;
  private logger: Logger;
  private readonly retryStrategies: Map<ErrorCode, RetryStrategy>;

  constructor(
    eventBus?: EventBus,
    memoryOptimizationService?: MemoryOptimizationService,
    loggingService?: LoggingService,
  ) {
    this.eventBus = eventBus;
    this.memoryOptimizationService = memoryOptimizationService;
    this.retryStrategies = createRetryStrategies();
    this.logger = createLogger(
      "ErrorRecoveryService",
      loggingService ||
        new LoggingService({
          enabled: false,
          level: "error",
          includeTimestamp: true,
          includeService: true,
        }),
    );
  }

  canRetry(error: ProviderError): boolean {
    const strategy = this.retryStrategies.get(error.code as ErrorCode);
    return strategy !== undefined;
  }

  shouldFallback(error: ProviderError): boolean {
    const fallbackCodes: ErrorCode[] = [
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      ErrorCodes.MODEL_NOT_SUPPORTED,
      ErrorCodes.GENERATION_FAILED,
      ErrorCodes.NETWORK_ERROR,
      ErrorCodes.CONFIGURATION_ERROR,
    ];

    return fallbackCodes.includes(error.code as ErrorCode);
  }

  getRetryDelay(attempt: number, error: ProviderError, retryAfterMs?: number): number {
    const strategy = this.retryStrategies.get(error.code as ErrorCode);
    if (!strategy) {
      return ServiceLimits.baseRetryDelay;
    }

    if (retryAfterMs && retryAfterMs > 0) {
      return Math.min(retryAfterMs, strategy.maxDelay);
    }

    const exponentialDelay = strategy.baseDelay * Math.pow(2, attempt - 1);
    let delay = Math.min(exponentialDelay, strategy.maxDelay);

    if (strategy.jitter) {
      const jitterAmount = delay * this.JITTER_FACTOR;
      const jitter = (Math.random() * 2 - 1) * jitterAmount;
      delay = Math.max(strategy.baseDelay, delay + jitter);
    }

    return Math.round(delay);
  }

  private extractRetryAfter(error: ProviderError): number | undefined {
    const originalError = error.originalError;
    if (!originalError) return undefined;

    if (typeof originalError === "object" && originalError !== null) {
      const headers = originalError.headers || originalError.response?.headers;
      if (headers) {
        const retryAfter = headers.get?.("retry-after") || headers["retry-after"];
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds) && seconds > 0) {
            return seconds * 1000;
          }
        }
      }

      if (originalError.retryAfter) {
        const retryAfter = originalError.retryAfter;
        if (typeof retryAfter === "number" && retryAfter > 0) {
          return retryAfter;
        }
      }
    }

    return undefined;
  }

  getUserFriendlyMessage(error: ProviderError, retryContext?: RetryContext): string {
    const { message } = getErrorMessage(error.code, error.providerId);
    const baseMessage = message;

    if (retryContext && retryContext.attempt < retryContext.maxAttempts) {
      const attemptsRemaining = retryContext.maxAttempts - retryContext.attempt;
      const delaySeconds = Math.ceil(retryContext.delay / 1000);

      if (error.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
        return `${baseMessage} Retrying in ${delaySeconds} second${delaySeconds !== 1 ? "s" : ""} (${attemptsRemaining} attempt${attemptsRemaining !== 1 ? "s" : ""} remaining).`;
      }

      if (error.code === ErrorCodes.NETWORK_ERROR) {
        return `${baseMessage} Retrying automatically (${attemptsRemaining} attempt${attemptsRemaining !== 1 ? "s" : ""} remaining).`;
      }

      return `${baseMessage} Will retry automatically (${attemptsRemaining} attempt${attemptsRemaining !== 1 ? "s" : ""} remaining).`;
    }

    if (retryContext && retryContext.attempt >= retryContext.maxAttempts) {
      return `${baseMessage} All retry attempts exhausted.`;
    }

    return baseMessage;
  }

  async handleProviderDiscoveryError(error: any, providerId: string): Promise<void> {
    const providerError =
      error instanceof ProviderError
        ? error
        : new ProviderError(
            "PROVIDER_DISCOVERY_FAILED",
            `Failed to discover provider ${providerId}: ${error?.message || error}`,
            providerId,
          );

    if (this.eventBus) {
      this.eventBus.publish("providerDiscoveryError", providerError);
    }
  }

  async handleMemoryError(error: any): Promise<void> {
    if (this.memoryOptimizationService) {
      await this.memoryOptimizationService.optimizeMemory();
    }

    const memoryError =
      error instanceof ProviderError
        ? error
        : new ProviderError(
            "MEMORY_ERROR",
            `Memory optimization required: ${error?.message || error}`,
            "system",
          );

    if (this.eventBus) {
      this.eventBus.publish("memoryError", memoryError);
    }
  }

  async handlePerformanceError(error: any, operation: string): Promise<void> {
    const performanceError =
      error instanceof ProviderError
        ? error
        : new ProviderError(
            "PERFORMANCE_ERROR",
            `Performance issue in ${operation}: ${error?.message || error}`,
            "system",
          );

    if (this.eventBus) {
      this.eventBus.publish("performanceError", performanceError);
    }

    if (this.memoryOptimizationService) {
      await this.memoryOptimizationService.optimizeMemory();
    }
  }

  async handleCacheError(error: any, operation: string): Promise<void> {
    const cacheError =
      error instanceof ProviderError
        ? error
        : new ProviderError(
            "CACHE_ERROR",
            `Cache operation failed in ${operation}: ${error?.message || error}`,
            "system",
          );

    if (this.eventBus) {
      this.eventBus.publish("cacheError", cacheError);
    }
  }

  getActionableSuggestion(error: ProviderError, retryContext?: RetryContext): string {
    const { suggestion } = getErrorMessage(error.code, error.providerId);
    const baseSuggestion = suggestion;

    if (retryContext && retryContext.attempt >= retryContext.maxAttempts) {
      if (error.code === ErrorCodes.NETWORK_ERROR) {
        return `${baseSuggestion} If the problem persists, check your firewall settings or try using a different network connection.`;
      }

      if (error.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
        return `${baseSuggestion} Consider waiting a few minutes before trying again, or switch to a different provider temporarily.`;
      }

      if (error.code === ErrorCodes.GENERATION_FAILED) {
        return `${baseSuggestion} Try with a smaller code selection or a different provider.`;
      }
    }

    return baseSuggestion;
  }

  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    errorClassifier: (error: any) => ProviderError,
    providerId: string,
  ): Promise<T> {
    let lastError: ProviderError | undefined;

    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS * 2; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = errorClassifier(error);

        if (lastError.code === ErrorCodes.CONFIGURATION_ERROR && this.memoryOptimizationService) {
          await this.memoryOptimizationService.optimizeMemory();
        }

        const currentStrategy = this.getRetryStrategyForError(lastError);
        const retryAfterMs = this.extractRetryAfter(lastError);

        if (!this.canRetry(lastError) || attempt >= currentStrategy.maxAttempts) {
          const retryContext: RetryContext = {
            attempt,
            maxAttempts: currentStrategy.maxAttempts,
            delay: 0,
            error: lastError,
            providerId,
          };

          this.logger.warn("Retry attempts exhausted", {
            errorCode: lastError.code,
            providerId,
            attempts: attempt,
            maxAttempts: currentStrategy.maxAttempts,
          });

          if (this.eventBus) {
            this.eventBus.publish("operationFailed", {
              error: lastError,
              providerId,
              attempts: attempt,
              operation: "executeWithRetry",
              userMessage: this.getUserFriendlyMessage(lastError, retryContext),
              suggestion: this.getActionableSuggestion(lastError, retryContext),
            });
          }
          throw lastError;
        }

        const delay = this.getRetryDelay(attempt, lastError, retryAfterMs);
        const retryContext: RetryContext = {
          attempt,
          maxAttempts: currentStrategy.maxAttempts,
          delay,
          error: lastError,
          providerId,
        };

        this.logger.debug("Retrying operation", {
          errorCode: lastError.code,
          providerId,
          attempt,
          maxAttempts: currentStrategy.maxAttempts,
          delayMs: delay,
          retryAfterMs,
        });

        await this.sleep(delay);
      }
    }

    if (!lastError) {
      throw new ProviderError(
        ErrorCodes.GENERATION_FAILED,
        "Operation failed with unknown error",
        providerId,
      );
    }

    throw lastError;
  }

  private getRetryStrategyForError(error: ProviderError): RetryStrategy {
    const strategy = this.retryStrategies.get(error.code as ErrorCode);
    if (strategy) {
      return strategy;
    }

    return {
      maxAttempts: this.MAX_RETRY_ATTEMPTS,
      baseDelay: ServiceLimits.baseRetryDelay,
      maxDelay: ServiceLimits.maxRetryDelay,
      jitter: true,
      retryableCodes: [],
    };
  }
}
