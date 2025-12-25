export class ProviderError extends Error {
  public readonly code: string;
  public readonly providerId?: string;
  public readonly originalError?: unknown;
  public waitTimeMs?: number;

  constructor(code: string, message: string, providerId?: string, originalError?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.providerId = providerId;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      providerId: this.providerId,
      originalError: this.originalError,
      stack: this.stack,
    };
  }

  static fromError(error: unknown, providerId?: string): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    const errorObj = error as Record<string, unknown> | null;
    const code = (errorObj?.code as string) || "UNKNOWN_ERROR";
    const message =
      (errorObj?.message as string) || (error instanceof Error ? error.message : String(error));
    return new ProviderError(code, message, providerId, error);
  }
}
