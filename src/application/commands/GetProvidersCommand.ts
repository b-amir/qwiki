import type { Command } from "./Command";
import type { LLMRegistry } from "../../llm";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { MessageBusService } from "../services/MessageBusService";
import type { ConfigurationManagerService } from "../services/ConfigurationManagerService";
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
    private configurationManager: ConfigurationManagerService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService({
      mode: "none",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("GetProvidersCommand");
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

      const providerIds = list.map((p) => (typeof p.id === "string" ? p.id : String(p.id || "")));
      const apiKeyChecks = await Promise.allSettled(
        providerIds.map(async (providerId) => {
          const hasSecretKey = await this.apiKeyRepository.has(providerId as ProviderId);
          const providerConfig = await this.configurationManager.getProviderConfig(providerId);
          const hasConfigKey = Boolean(providerConfig?.apiKey);
          return { providerId, hasKey: hasSecretKey || hasConfigKey };
        }),
      );

      const apiKeyMap = new Map<string, boolean>();
      apiKeyChecks.forEach((result, index) => {
        if (result.status === "fulfilled") {
          apiKeyMap.set(result.value.providerId, result.value.hasKey);
        } else {
          apiKeyMap.set(providerIds[index], false);
        }
      });

      const statuses = await Promise.allSettled(
        list.map(async (p) => {
          const providerProcessStartTime = Date.now();
          let providerId = "";
          let providerName = "";
          let models: string[] = [];

          try {
            providerId = typeof p.id === "string" ? p.id : String(p.id || "");

            const provider = this.llmRegistry.getProvider(providerId as ProviderId);
            if (provider) {
              providerName = provider.name;
              try {
                const providerModels = provider.listModels?.() || [];
                if (Array.isArray(providerModels) && providerModels.length > 0) {
                  models = providerModels.filter(
                    (m): m is string => typeof m === "string" && m.length > 0,
                  );
                }
              } catch (error) {
                this.logError(`Error getting models for provider ${providerId}`, error);
              }
            } else {
              providerName = typeof p.name === "string" ? p.name : String(p.name || "");
              const initialModels = p.models || [];
              if (Array.isArray(initialModels)) {
                models = initialModels.filter(
                  (m): m is string => typeof m === "string" && m.length > 0,
                );
              }
            }

            const hasKey = apiKeyMap.get(providerId) || false;

            const providerProcessEndTime = Date.now();
            this.logDebug(
              `Processed provider ${providerId} in ${providerProcessEndTime - providerProcessStartTime}ms`,
              { models: models.length, hasKey },
            );

            return {
              id: providerId,
              name: providerName,
              models,
              hasKey,
            };
          } catch (error) {
            const providerProcessEndTime = Date.now();
            const errorMessage =
              error instanceof Error
                ? error.message
                : typeof error === "string"
                  ? error
                  : JSON.stringify(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logError(
              `Fatal error processing provider ${providerId || p.id || "unknown"} after ${providerProcessEndTime - providerProcessStartTime}ms`,
              {
                error: errorMessage,
                stack: errorStack,
                providerId,
                providerName,
              },
            );

            return {
              id: providerId || String(p.id || ""),
              name: providerName || String(p.name || ""),
              models: [],
              hasKey: false,
            };
          }
        }),
      );

      const successfulStatuses = statuses
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .map((result) => result.value);

      const failedStatuses = statuses
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result, index) => {
          this.logError(`Provider processing failed`, result.reason);
          const p = list[index];
          return {
            id: typeof p?.id === "string" ? p.id : String(p?.id || ""),
            name: typeof p?.name === "string" ? p.name : String(p?.name || ""),
            models: [] as string[],
            hasKey: false,
          };
        });

      const allStatuses = [...successfulStatuses, ...failedStatuses];

      const statusesEndTime = Date.now();
      this.logDebug(`All provider statuses processed in ${statusesEndTime - statusesStartTime}ms`);

      this.messageBus.postSuccess(OutboundEvents.providers, allStatuses);
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
