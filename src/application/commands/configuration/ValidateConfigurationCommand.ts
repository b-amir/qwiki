import type { Command } from "@/application/commands/Command";
import type { EventBus } from "@/events";
import type { ValidationResult } from "@/domain/configuration";
import { MessageBusService } from "@/application/services/core/MessageBusService";
import { ErrorCodes } from "@/constants/ErrorCodes";

export interface ValidateConfigurationPayload {
  providerId?: string;
  config: Record<string, unknown>;
}

export class ValidateConfigurationCommand implements Command<ValidateConfigurationPayload> {
  constructor(
    private configurationValidator: import("@/application/services/configuration/ConfigurationValidationEngineService").ConfigurationValidationEngineService,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: ValidateConfigurationPayload): Promise<void> {
    try {
      let validationResult: ValidationResult;

      if (payload.providerId) {
        validationResult = this.configurationValidator.validateProviderConfig(
          payload.providerId,
          payload.config,
          undefined,
        );
      } else {
        validationResult = this.configurationValidator.validateGlobalConfig(payload.config);
      }

      if (!validationResult.isValid && validationResult.errors.length > 0) {
        const errorMessages = validationResult.errors.map((e) => {
          if (typeof e === "string") return e;
          return e.message || JSON.stringify(e);
        });

        const suggestions = validationResult.errors
          .filter((e) => typeof e !== "string" && e.code)
          .map((e) => {
            if (e.code === "API_KEY_REQUIRED") return "Please enter a valid API key";
            if (e.code === "API_KEY_TOO_SHORT")
              return "API key appears to be too short. Please check and enter a valid key.";
            if (e.code === "MODEL_INVALID_TYPE") return "Please select a valid model";
            return `Please check the ${e.field || "configuration"} field`;
          });

        const providerName = payload.providerId
          ? ` for ${payload.providerId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}`
          : "";

        this.messageBus.postError(
          `Configuration validation failed${providerName}: ${errorMessages[0]}`,
          ErrorCodes.validationFailed,
          suggestions.length > 0
            ? suggestions[0]
            : "Please review the validation errors and fix them before continuing.",
          {
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            providerId: payload.providerId,
          },
        );
      }

      this.messageBus.postSuccess("configurationValidated", {
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        providerId: payload.providerId,
      });
    } catch (error) {
      this.messageBus.postError(
        `Failed to validate configuration: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCodes.validationFailed,
      );
    }
  }
}
