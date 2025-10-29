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
    const executeStartTime = Date.now();
    console.log("[QWIKI] GetProviderConfigsCommand: Starting to get provider configs");

    try {
      const configsStartTime = Date.now();
      const configs = await this.llmRegistry.getProviderConfigs();
      const configsEndTime = Date.now();

      console.log(
        `[QWIKI] GetProviderConfigsCommand: Retrieved ${configs.length} provider configs in ${configsEndTime - configsStartTime}ms`,
      );

      this.messageBus.postSuccess(OutboundEvents.providerConfigs, configs);

      const executeEndTime = Date.now();
      console.log(
        `[QWIKI] GetProviderConfigsCommand: Command completed successfully in ${executeEndTime - executeStartTime}ms`,
      );
    } catch (error) {
      const executeEndTime = Date.now();
      console.error(
        `[QWIKI] GetProviderConfigsCommand: Command failed after ${executeEndTime - executeStartTime}ms:`,
        error,
      );
      throw error;
    }
  }
}
