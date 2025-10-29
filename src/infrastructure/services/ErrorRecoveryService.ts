import { ProviderError, ErrorCodes, type ErrorCode, getErrorMessage } from "../../errors";
import { EventBus } from "../../events/EventBus";
import { MemoryOptimizationService } from "./MemoryOptimizationService";

export class ErrorRecoveryService {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly BASE_RETRY_DELAY = 1000;
  private readonly MAX_RETRY_DELAY = 10000;
  private eventBus?: EventBus;
  private memoryOptimizationService?: MemoryOptimizationService;

  constructor(eventBus?: EventBus, memoryOptimizationService?: MemoryOptimizationService) {
    this.eventBus = eventBus;
    this.memoryOptimizationService = memoryOptimizationService;
  }

  canRetry(error: ProviderError): boolean {
    const retryableCodes: ErrorCode[] = [ErrorCodes.NETWORK_ERROR, ErrorCodes.RATE_LIMIT_EXCEEDED];

    return retryableCodes.includes(error.code as ErrorCode);
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

  getRetryDelay(attempt: number, error: ProviderError): number {
    const baseDelay = this.BASE_RETRY_DELAY;
    const maxDelay = this.MAX_RETRY_DELAY;

    let delay = baseDelay * Math.pow(2, attempt - 1);

    if (error.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
      delay = Math.max(delay, 5000);
    }

    return Math.min(delay, maxDelay);
  }

  getUserFriendlyMessage(error: ProviderError): string {
    const { message } = getErrorMessage(error.code, error.providerId);
    return message;
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

  getActionableSuggestion(error: ProviderError): string {
    const { suggestion } = getErrorMessage(error.code, error.providerId);
    return suggestion;
  }

  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    errorClassifier: (error: any) => ProviderError,
    providerId: string,
  ): Promise<T> {
    let lastError: ProviderError;

    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = errorClassifier(error);

        if (lastError.code === ErrorCodes.CONFIGURATION_ERROR && this.memoryOptimizationService) {
          await this.memoryOptimizationService.optimizeMemory();
        }

        if (!this.canRetry(lastError) || attempt === this.MAX_RETRY_ATTEMPTS) {
          if (this.eventBus) {
            this.eventBus.publish("operationFailed", {
              error: lastError,
              providerId,
              attempts: attempt,
              operation: "executeWithRetry",
            });
          }
          throw lastError;
        }

        const delay = this.getRetryDelay(attempt, lastError);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }
}
