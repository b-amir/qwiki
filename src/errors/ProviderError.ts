export class ProviderError extends Error {
  public readonly code: string;
  public readonly providerId?: string;
  public readonly originalError?: any;

  constructor(code: string, message: string, providerId?: string, originalError?: any) {
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

  static fromError(error: any, providerId?: string): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }
    
    const code = error.code || 'UNKNOWN_ERROR';
    const message = error.message || error.toString();
    return new ProviderError(code, message, providerId, error);
  }
}
