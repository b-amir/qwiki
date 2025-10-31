import type { Command } from "./Command";
import type { LLMRegistry } from "../../llm";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBus } from "../services/MessageBus";
import type { ConfigurationManager } from "../services/ConfigurationManager";
import { OutboundEvents } from "../../constants/Events";
import { ProviderId } from "../../llm/types";

export class GetProvidersCommand implements Command<void> {
  constructor(
    private llmRegistry: LLMRegistry,
    private apiKeyRepository: ApiKeyRepository,
    private configurationManager: ConfigurationManager,
    private messageBus: MessageBus,
  ) {}

  private inFlight?: Promise<void>;
  private lastEmitAt = 0;
  private cooldownMs = 500; // coalesce duplicate requests within 500ms

  async execute(): Promise<void> {
    const now = Date.now();
    if (this.inFlight) {
      console.log("[QWIKI] GetProvidersCommand: Coalescing duplicate call (in-flight)");
      return this.inFlight;
    }
    if (now - this.lastEmitAt < this.cooldownMs) {
      console.log("[QWIKI] GetProvidersCommand: Debounced duplicate call within cooldown");
      return;
    }

    const executeStartTime = now;
    console.log("[QWIKI] GetProvidersCommand: Starting to get providers list");

    this.inFlight = (async () => {
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

            const hasSecretKey = await this.apiKeyRepository.has(p.id as ProviderId);
            const providerConfig = await this.configurationManager.getProviderConfig(p.id);
            const hasConfigKey = Boolean(providerConfig?.apiKey);
            const hasKey = hasSecretKey || hasConfigKey;

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
      this.lastEmitAt = Date.now();
      const executeEndTime = Date.now();
      console.log(
        `[QWIKI] GetProvidersCommand: Command completed successfully in ${executeEndTime - executeStartTime}ms`,
      );
    })()
      .catch((error) => {
        const executeEndTime = Date.now();
        console.error(
          `[QWIKI] GetProvidersCommand: Command failed after ${executeEndTime - executeStartTime}ms:`,
          error,
        );
        throw error;
      })
      .finally(() => {
        this.inFlight = undefined;
      });

    return this.inFlight;
  }
}
