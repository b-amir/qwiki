import type { Command } from "./Command";
import type { LLMRegistry } from "../../llm";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";

export class GetProviderConfigsCommand implements Command<void> {
  constructor(
    private llmRegistry: LLMRegistry,
    private messageBus: MessageBus,
  ) {}

  async execute(): Promise<void> {
    const configs = this.llmRegistry.getProviderConfigs();
    this.messageBus.postSuccess(OutboundEvents.providerConfigs, configs);
  }
}
