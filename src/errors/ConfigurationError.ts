import { BaseError } from "./BaseError";

export class ConfigurationError extends BaseError {
  constructor(
    code: "invalidConfiguration",
    message?: string,
    context?: Record<string, any>
  ) {
    super(code, message, context);
  }
}