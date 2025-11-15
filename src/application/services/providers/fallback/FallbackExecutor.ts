import { ProviderError } from "@/errors/ProviderError";
import { ServiceLimits } from "@/constants";
import type {
  FallbackResult,
  FallbackStrategy,
  ProviderOperation,
  FallbackChain,
} from "../ProviderFallbackManagerService";
import { CircuitBreakerManager } from "@/application/services/providers/fallback/CircuitBreakerManager";
import { RetryStrategyCalculator } from "@/application/services/providers/fallback/RetryStrategyCalculator";

export class FallbackExecutor {
  constructor(
    private circuitBreakerManager: CircuitBreakerManager,
    private retryCalculator: RetryStrategyCalculator,
  ) {}

  async executeWithFallback<T>(
    operation: ProviderOperation<T>,
    fallbackChain: FallbackChain,
    strategy: FallbackStrategy,
  ): Promise<FallbackResult<T>> {
    const startTime = Date.now();
    const usedProviders: string[] = [];
    let attempts = 0;
    let lastError: ProviderError | undefined;

    const providersToTry = [fallbackChain.primaryProvider, ...fallbackChain.fallbackProviders];

    for (const providerId of providersToTry) {
      if (attempts >= strategy.maxAttempts) {
        break;
      }

      if (!this.circuitBreakerManager.isProviderAvailable(providerId)) {
        continue;
      }

      usedProviders.push(providerId);
      attempts++;

      try {
        const result = await this.executeWithTimeout(
          () => operation.execute(providerId),
          operation.timeout || ServiceLimits.operationDefaultTimeout,
        );

        this.circuitBreakerManager.recordSuccess(providerId);

        return {
          success: true,
          result,
          attempts,
          totalDuration: Date.now() - startTime,
          usedProviders,
          appliedStrategy: strategy,
        };
      } catch (error) {
        lastError = error as ProviderError;
        this.circuitBreakerManager.recordFailure(providerId, lastError);

        if (!this.retryCalculator.shouldRetry(lastError, strategy)) {
          break;
        }

        if (attempts < strategy.maxAttempts) {
          const delay = this.retryCalculator.calculateDelay(attempts, strategy);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration: Date.now() - startTime,
      usedProviders,
      appliedStrategy: strategy,
    };
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ProviderError("TIMEOUT", `Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
