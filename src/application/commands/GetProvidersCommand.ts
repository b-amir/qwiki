import type { Command } from "./Command";
import type { LLMRegistry } from "../../llm";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBus } from "../services/MessageBus";
import type { ConfigurationManager } from "../services/ConfigurationManager";
import { OutboundEvents } from "../../constants/Events";
import { ProviderId } from "../../llm/types";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class GetProvidersCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private apiKeyRepository: ApiKeyRepository,
    private configurationManager: ConfigurationManager,
    private messageBus: MessageBus,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("GetProvidersCommand", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  private inFlight?: Promise<void>;
  private lastEmitAt = 0;
  private cooldownMs = 500; // coalesce duplicate requests within 500ms

  async execute(): Promise<void> {
    const now = Date.now();
    if (this.inFlight) {
      this.logDebug("Coalescing duplicate call (in-flight)");
      return this.inFlight;
    }
    if (now - this.lastEmitAt < this.cooldownMs) {
      this.logDebug("Debounced duplicate call within cooldown");
      return;
    }

    const executeStartTime = now;
    this.logDebug("Starting to get providers list");

    this.inFlight = (async () => {
      const listStartTime = Date.now();
      const list = this.llmRegistry.list();
      const listEndTime = Date.now();
      this.logDebug(
        `Retrieved ${list.length} providers from registry in ${listEndTime - listStartTime}ms`,
      );

      const statusesStartTime = Date.now();
      this.logDebug("Processing provider statuses");

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
            this.logDebug(
              `Processed provider ${p.id} in ${providerProcessEndTime - providerProcessStartTime}ms`,
              { models: models.length, hasKey },
            );

            return {
              id: p.id,
              name: p.name,
              models,
              hasKey,
            };
          } catch (error) {
            const providerProcessEndTime = Date.now();
            this.logError(
              `Error processing provider ${p.id} after ${providerProcessEndTime - providerProcessStartTime}ms`,
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
      this.logDebug(`All provider statuses processed in ${statusesEndTime - statusesStartTime}ms`);

      this.messageBus.postSuccess(OutboundEvents.providers, statuses);
      this.lastEmitAt = Date.now();
      const executeEndTime = Date.now();
      this.logDebug(`Command completed successfully in ${executeEndTime - executeStartTime}ms`);
    })()
      .catch((error) => {
        const executeEndTime = Date.now();
        this.logError(`Command failed after ${executeEndTime - executeStartTime}ms`, error);
        throw error;
      })
      .finally(() => {
        this.inFlight = undefined;
      });

    return this.inFlight;
  }
}
