import type { Command } from "./Command";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBusService } from "../services/MessageBusService";
import type { LLMRegistry } from "../../llm";
import type { ProviderValidationService } from "../../infrastructure/services/ProviderValidationService";
import { OutboundEvents } from "../../constants/Events";
import { ErrorCodes } from "../../constants/ErrorCodes";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface SaveApiKeyPayload {
  providerId: string;
  apiKey: string;
}

export class SaveApiKeyCommand implements Command<SaveApiKeyPayload> {
  private logger: Logger;

  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private messageBus: MessageBusService,
    private llmRegistry: LLMRegistry,
    private providerValidationService: ProviderValidationService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("SaveApiKeyCommand");
  }

  async execute(payload: SaveApiKeyPayload): Promise<void> {
    const trimmedKey = payload.apiKey?.trim() || "";

    if (!trimmedKey) {
      this.logger.warn(`Attempted to save empty API key for provider ${payload.providerId}`);
      this.messageBus.postError(
        "API key cannot be empty",
        ErrorCodes.apiKeyInvalid,
        "Please provide a valid API key",
        { providerId: payload.providerId },
      );
      return;
    }

    const provider = this.llmRegistry.getProvider(payload.providerId as any);
    if (!provider) {
      this.logger.error(`Provider not found: ${payload.providerId}`);
      this.messageBus.postError(
        `Provider not found: ${payload.providerId}`,
        ErrorCodes.missingProvider,
        "Please select a valid provider",
        { providerId: payload.providerId },
      );
      return;
    }

    if (provider.requiresApiKey) {
      const formatValidation = await this.providerValidationService.validateApiKeyFormat(
        payload.providerId,
        trimmedKey,
      );

      if (!formatValidation.isValid) {
        const errorMessage = formatValidation.errors[0]?.message || "API key format is invalid";
        this.logger.warn(`API key format validation failed for ${payload.providerId}`, {
          errors: formatValidation.errors,
        });
        this.messageBus.postError(
          errorMessage,
          ErrorCodes.apiKeyInvalid,
          "Please check your API key format and try again",
          { providerId: payload.providerId, errors: formatValidation.errors },
        );
        return;
      }
    }

    try {
      await this.apiKeyRepository.save(payload.providerId, trimmedKey);
      this.providerValidationService.invalidateValidationCache(payload.providerId);
      this.messageBus.postSuccess(OutboundEvents.apiKeySaved, { providerId: payload.providerId });
      this.logger.debug(`API key saved successfully for provider ${payload.providerId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save API key";
      this.logger.error(`Error saving API key for ${payload.providerId}:`, error);
      this.messageBus.postError(
        errorMessage,
        ErrorCodes.apiKeyInvalid,
        "Please check your API key and try again. If the problem persists, check VS Code SecretStorage permissions.",
        { providerId: payload.providerId },
        errorMessage,
      );
    }
  }
}
