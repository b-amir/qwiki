import { BaseError } from "./BaseError";

export class CommandError extends BaseError {
  constructor(code: "missingCommand", message?: string, context?: Record<string, any>) {
    super(code, message, context);
  }
}
