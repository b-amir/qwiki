import type { Command } from "./Command";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBusService } from "../services/MessageBusService";
import { OutboundEvents } from "../../constants/Events";

interface DeleteApiKeyPayload {
  providerId: string;
}

export class DeleteApiKeyCommand implements Command<DeleteApiKeyPayload> {
  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: DeleteApiKeyPayload): Promise<void> {
    await this.apiKeyRepository.delete(payload.providerId);
    this.messageBus.postSuccess(OutboundEvents.apiKeyDeleted, { providerId: payload.providerId });
  }
}
