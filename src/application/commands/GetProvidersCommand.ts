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
    const executeStartTime = Date.now();
    console.log("[QWIKI] GetProvidersCommand: Starting to get providers list");

    try {
      const listStartTime = Date.now();
      const list = this.llmRegistry.list();
      const listEndTime = Date.now();
      console.log(
        `[QWIKI] GetProvidersCommand: Retrieved ${list.length} providers from registry in ${listEndTime - listStartTime}ms`,
      );

      const statusesStartTime = Date.now();
      console.log("[QWIKI] GetProvidersCommand: Processing provider statuses");

      const statuses = await Promise.all(
        list.map(async (p) => {
          const providerProcessStartTime = Date.now();

          try {
            const provider = this.llmRegistry.getProvider(p.id as ProviderId);
            const hasKey = await this.apiKeyRepository.has(p.id as ProviderId);
            const models = provider?.listModels?.() || [];

            const providerProcessEndTime = Date.now();
            console.log(
              `[QWIKI] GetProvidersCommand: Processed provider ${p.id} in ${providerProcessEndTime - providerProcessStartTime}ms - Models: ${models.length}, HasKey: ${hasKey}`,
            );

            return {
              id: p.id,
              name: p.name,
              models,
              hasKey,
            };
          } catch (error) {
            const providerProcessEndTime = Date.now();
            console.error(
              `[QWIKI] GetProvidersCommand: Error processing provider ${p.id} after ${providerProcessEndTime - providerProcessStartTime}ms:`,
              error,
            );

            return {
              id: p.id,
              name: p.name,
              models: [],
              hasKey: false,
            };
          }
        }),
      );

      const statusesEndTime = Date.now();
      console.log(
        `[QWIKI] GetProvidersCommand: All provider statuses processed in ${statusesEndTime - statusesStartTime}ms`,
      );

      this.messageBus.postSuccess(OutboundEvents.providers, statuses);

      const executeEndTime = Date.now();
      console.log(
        `[QWIKI] GetProvidersCommand: Command completed successfully in ${executeEndTime - executeStartTime}ms`,
      );
    } catch (error) {
      const executeEndTime = Date.now();
      console.error(
        `[QWIKI] GetProvidersCommand: Command failed after ${executeEndTime - executeStartTime}ms:`,
        error,
      );
      throw error;
    }
  }
}
