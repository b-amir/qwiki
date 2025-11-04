import type { Command } from "./Command";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBusService } from "../services/MessageBusService";
import type { ProviderValidationService } from "../../infrastructure/services/ProviderValidationService";
import { OutboundEvents } from "../../constants/Events";
import { ErrorCodes, ErrorMessages } from "../../constants/ErrorCodes";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface DeleteApiKeyPayload {
  providerId: string;
}

export class DeleteApiKeyCommand implements Command<DeleteApiKeyPayload> {
  private logger: Logger;

  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private messageBus: MessageBusService,
    private providerValidationService: ProviderValidationService,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("DeleteApiKeyCommand", loggingService);
  }

  async execute(payload: DeleteApiKeyPayload): Promise<void> {
    const hasAnyKeyBeforeDelete = await this.providerValidationService.hasAnyApiKey();

    try {
      await this.apiKeyRepository.delete(payload.providerId);
      this.providerValidationService.invalidateValidationCache(payload.providerId);

      const hasAnyKeyAfterDelete = await this.providerValidationService.hasAnyApiKey();

      if (hasAnyKeyBeforeDelete && !hasAnyKeyAfterDelete) {
        this.logger.warn(
          `Deleted last API key for provider ${payload.providerId}. No API keys remaining.`,
        );
        this.messageBus.postSuccess(OutboundEvents.apiKeyDeleted, {
          providerId: payload.providerId,
        });
        this.messageBus.postError(
          ErrorMessages[ErrorCodes.noApiKeysConfigured],
          ErrorCodes.noApiKeysConfigured,
          "Please configure at least one API key to use the extension",
          { providerId: payload.providerId, warning: true },
        );
      } else {
        this.messageBus.postSuccess(OutboundEvents.apiKeyDeleted, {
          providerId: payload.providerId,
        });
        this.logger.debug(`API key deleted successfully for provider ${payload.providerId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete API key";
      this.logger.error(`Error deleting API key for ${payload.providerId}:`, error);
      this.messageBus.postError(
        errorMessage,
        ErrorCodes.apiKeyInvalid,
        "Please try again. If the problem persists, check VS Code SecretStorage permissions.",
        { providerId: payload.providerId },
        errorMessage,
      );
    }
  }
}
