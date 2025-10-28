import type { Command } from "./Command";
import type { LLMRegistry } from "../../llm";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";
import { ProviderId } from "../../llm/types";

export class GetProvidersCommand implements Command<void> {
  constructor(
    private llmRegistry: LLMRegistry,
    private apiKeyRepository: ApiKeyRepository,
    private messageBus: MessageBus,
  ) {}

  async execute(): Promise<void> {
    const list = this.llmRegistry.list();
    const statuses = await Promise.all(
      list.map(async (p) => {
        const provider = this.llmRegistry.getProvider(p.id as ProviderId);
        return {
          id: p.id,
          name: p.name,
          models: provider?.listModels?.() || [],
          hasKey: await this.apiKeyRepository.has(p.id as ProviderId),
        };
      }),
    );
    this.messageBus.postSuccess(OutboundEvents.providers, statuses);
  }
}
