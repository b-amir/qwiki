import type { Command } from "./Command";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";
import type { ProviderId } from "../../llm/types";

interface DeleteApiKeyPayload {
  providerId: ProviderId;
}

export class DeleteApiKeyCommand implements Command<DeleteApiKeyPayload> {
  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private messageBus: MessageBus,
  ) {}

  async execute(payload: DeleteApiKeyPayload): Promise<void> {
    await this.apiKeyRepository.delete(payload.providerId);
    this.messageBus.postSuccess(OutboundEvents.apiKeyDeleted, { providerId: payload.providerId });
  }
}
