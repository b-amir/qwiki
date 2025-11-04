import type { Command } from "./Command";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBusService } from "../services/MessageBusService";
import { OutboundEvents } from "../../constants/Events";
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
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("SaveApiKeyCommand", loggingService);
  }

  async execute(payload: SaveApiKeyPayload): Promise<void> {
    if (!payload.apiKey || payload.apiKey.trim().length === 0) {
      this.logger.warn(`Attempted to save empty API key for provider ${payload.providerId}`);
      return;
    }

    await this.apiKeyRepository.save(payload.providerId, payload.apiKey);
    this.messageBus.postSuccess(OutboundEvents.apiKeySaved, { providerId: payload.providerId });
  }
}
