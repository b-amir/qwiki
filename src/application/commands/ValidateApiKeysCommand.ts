import type { Command } from "./Command";
import type { ProviderValidationService } from "../../infrastructure/services/ProviderValidationService";
import type { MessageBusService } from "../services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface ValidateApiKeysPayload {
  providerIds?: string[];
}

export class ValidateApiKeysCommand implements Command<ValidateApiKeysPayload> {
  private logger: Logger;

  constructor(
    private providerValidationService: ProviderValidationService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("ValidateApiKeysCommand", loggingService);
  }

  async execute(payload: ValidateApiKeysPayload): Promise<void> {
    try {
      const globalValidation = await this.providerValidationService.validateAtLeastOneApiKey();

      if (payload.providerIds && payload.providerIds.length > 0) {
        const providerValidations = await Promise.all(
          payload.providerIds.map(async (providerId) => {
            const result = await this.providerValidationService.validateApiKey(providerId);
            return { providerId, result };
          }),
        );

        const validationResults = providerValidations.reduce(
          (acc, { providerId, result }) => {
            acc[providerId] = result;
            return acc;
          },
          {} as Record<string, (typeof providerValidations)[0]["result"]>,
        );

        this.messageBus.postSuccess("apiKeysValidated", {
          globalValidation,
          providerValidations: validationResults,
        });

        this.logger.debug("API keys validation completed", {
          providerCount: payload.providerIds.length,
          globalValid: globalValidation.isValid,
        });
      } else {
        this.messageBus.postSuccess("apiKeysValidated", {
          globalValidation,
          providerValidations: {},
        });

        this.logger.debug("Global API keys validation completed", {
          globalValid: globalValidation.isValid,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to validate API keys";
      this.logger.error("Error validating API keys:", error);
      this.messageBus.postError(
        errorMessage,
        "error.validationFailed",
        "Please try again",
        { payload },
        errorMessage,
      );
    }
  }
}
