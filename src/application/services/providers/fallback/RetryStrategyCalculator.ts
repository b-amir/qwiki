import { ProviderError } from "@/errors/ProviderError";
import type { FallbackStrategy } from "@/application/services/providers/ProviderFallbackManagerService";

export class RetryStrategyCalculator {
  shouldRetry(error: ProviderError, strategy: FallbackStrategy): boolean {
    if (strategy.nonRetryableErrors.includes(error.code)) {
      return false;
    }

    if (strategy.retryableErrors.includes(error.code)) {
      return true;
    }

    return false;
  }

  calculateDelay(attempt: number, strategy: FallbackStrategy): number {
    switch (strategy.type) {
      case "immediate":
        return 0;
      case "linear":
        return Math.min(strategy.baseDelay * attempt, strategy.maxDelay);
      case "exponential":
        return Math.min(strategy.baseDelay * Math.pow(2, attempt - 1), strategy.maxDelay);
      case "adaptive":
        return Math.min(strategy.baseDelay * attempt * 1.5, strategy.maxDelay);
      default:
        return strategy.baseDelay;
    }
  }
}
