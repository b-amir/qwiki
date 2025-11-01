import type { Command } from "./Command";
import type { EventBus } from "../../events";
import type { ValidationResult } from "../../domain/configuration";
import { MessageBusService } from "../services/MessageBusService";

export interface ValidateConfigurationPayload {
  providerId?: string;
  config: any;
}

export class ValidateConfigurationCommand implements Command<ValidateConfigurationPayload> {
  constructor(
    private configurationValidator: import("../services/ConfigurationValidatorService").ConfigurationValidatorService,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: ValidateConfigurationPayload): Promise<void> {
    try {
      let validationResult: ValidationResult;

      if (payload.providerId) {
        validationResult = this.configurationValidator.validateProviderConfig(
          payload.providerId,
          payload.config,
        );
      } else {
        validationResult = this.configurationValidator.validateGlobalConfig(payload.config);
      }

      this.messageBus.postSuccess("configurationValidated", {
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    } catch (error) {
      this.messageBus.postError(
        `Failed to validate configuration: ${error instanceof Error ? error.message : String(error)}`,
        "VALIDATION_ERROR",
      );
    }
  }
}
