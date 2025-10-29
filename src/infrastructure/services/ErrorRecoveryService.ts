import { ProviderError, ErrorCodes, type ErrorCode, getErrorMessage } from "../../errors";

export class ErrorRecoveryService {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly BASE_RETRY_DELAY = 1000;
  private readonly MAX_RETRY_DELAY = 10000;

  canRetry(error: ProviderError): boolean {
    const retryableCodes: ErrorCode[] = [ErrorCodes.NETWORK_ERROR, ErrorCodes.RATE_LIMIT_EXCEEDED];

    return retryableCodes.includes(error.code as ErrorCode);
  }

  shouldFallback(error: ProviderError): boolean {
    const fallbackCodes: ErrorCode[] = [
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      ErrorCodes.MODEL_NOT_SUPPORTED,
      ErrorCodes.GENERATION_FAILED,
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

        if (!this.canRetry(lastError) || attempt === this.MAX_RETRY_ATTEMPTS) {
          throw lastError;
        }

        const delay = this.getRetryDelay(attempt, lastError);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }
}
