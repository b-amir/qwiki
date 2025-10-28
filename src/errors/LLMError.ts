import { BaseError } from "./BaseError";

export class LLMError extends BaseError {
  constructor(code: "missingProvider", message?: string, context?: Record<string, any>) {
    super(code, message, context);
  }
}
