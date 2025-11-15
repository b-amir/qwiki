import { BaseError } from "@/errors/BaseError";

export class RateLimitError extends BaseError {
  public readonly waitTimeMs: number;

  constructor(waitTimeMs: number, message?: string, context?: Record<string, unknown>) {
    super("rateLimitExceeded", message, context);
    this.waitTimeMs = waitTimeMs;
  }
}

