import { BaseError } from "./BaseError";

export class WikiError extends BaseError {
  constructor(
    code: "generationFailed" | "invalidSelection" | "missingSnippet",
    message?: string,
    context?: Record<string, any>,
  ) {
    super(code, message, context);
  }
}
