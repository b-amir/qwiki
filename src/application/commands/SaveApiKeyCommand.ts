import type { Command } from "./Command";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";
import { ProviderId } from "../../llm/types";

interface SaveApiKeyPayload {
  providerId: ProviderId;
  apiKey: string;
}

export class SaveApiKeyCommand implements Command<SaveApiKeyPayload> {
  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private messageBus: MessageBus,
  ) {}

  async execute(payload: SaveApiKeyPayload): Promise<void> {
    await this.apiKeyRepository.save(payload.providerId, payload.apiKey);
    this.messageBus.postSuccess(OutboundEvents.apiKeySaved, { providerId: payload.providerId });
  }
}
