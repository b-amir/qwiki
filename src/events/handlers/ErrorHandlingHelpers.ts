import type { EventBus } from "../EventBus";
import { OutboundEvents } from "../../constants/Events";
import { ErrorCodes } from "../../errors";
import { createLogger, type Logger, type LoggingService } from "../../infrastructure/services";

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ code: string; message: string; field?: string }>;
  warnings: Array<{ code: string; message: string; field?: string }>;
}

export async function publishValidationError(
  validationResult: ValidationResult,
  eventBus: EventBus,
  logger: Logger,
): Promise<void> {
  const firstError = validationResult.errors[0];
  const suggestion = getValidationSuggestion(firstError?.code);

  const errorPayload = {
    code: firstError?.code || ErrorCodes.VALIDATION_ERROR,
    message: firstError?.message || "Configuration validation failed",
    suggestions: [suggestion].filter(Boolean),
    timestamp: new Date().toISOString(),
    context: {
      validationErrors: validationResult.errors,
      validationWarnings: validationResult.warnings,
    },
    originalError: JSON.stringify(validationResult.errors),
  };

  logger.info("Publishing validation error to EventBus", {
    code: errorPayload.code,
    message: errorPayload.message,
    hasSuggestions: errorPayload.suggestions.length > 0,
  });

  await eventBus.publish(OutboundEvents.error, errorPayload);
}

function getValidationSuggestion(errorCode: string): string {
  switch (errorCode) {
    case ErrorCodes.API_KEY_MISSING:
      return "Please configure your API key in the settings.";
    case ErrorCodes.API_KEY_INVALID:
      return "Please check your API key format and try again.";
    case ErrorCodes.MODEL_NOT_SUPPORTED:
      return "Please select a different model for this provider.";
    case ErrorCodes.PROVIDER_NOT_FOUND:
      return "Please select a valid provider.";
    default:
      return "Please check your configuration settings.";
  }
}
