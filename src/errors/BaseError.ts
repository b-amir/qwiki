import { ErrorCodes } from "../constants";

export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(code: keyof typeof ErrorCodes, message?: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = ErrorCodes[code];
    this.timestamp = new Date();
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}