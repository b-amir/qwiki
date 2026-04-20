import type { LLMRegistry } from "@/llm";
import type { ApiKeyRepository } from "@/domain/repositories/ApiKeyRepository";
import type { ProviderId } from "@/llm/types";
import type { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import { ServiceLimits } from "@/constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

interface CachedModels {
  models: string[];
  cachedAt: number;
}

export class ProviderModelCatalogService {
  private logger: Logger;
  private cache = new Map<string, CachedModels>();

  constructor(
    private llmRegistry: LLMRegistry,
    private apiKeyRepository: ApiKeyRepository,
    private configurationManager: ConfigurationManagerService,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProviderModelCatalogService");
  }

  invalidateCache(providerId?: string): void {
    if (providerId) {
      const prefix = `${providerId}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  async resolveModelsForProvider(providerId: string): Promise<string[]> {
    const cacheKey = await this.buildCacheKey(providerId);
    const now = Date.now();
    const hit = this.cache.get(cacheKey);
    if (
      hit &&
      now - hit.cachedAt < ServiceLimits.providerModelCatalogCacheTtlMs &&
      hit.models.length > 0
    ) {
      return hit.models;
    }

    const provider = this.llmRegistry.getProvider(providerId);
    if (!provider) {
      return [];
    }

    const apiKey = await this.resolveApiKey(providerId);
    let models: string[] = [];

    if (provider.listModelsDynamic) {
      try {
        models = await provider.listModelsDynamic(apiKey);
      } catch (error) {
        this.logger.debug(`Dynamic model list failed for ${providerId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (models.length === 0) {
      models = provider.listModels();
    }

    this.cache.set(cacheKey, { models, cachedAt: now });
    return models;
  }

  private async buildCacheKey(providerId: string): Promise<string> {
    const hasKey = Boolean((await this.resolveApiKey(providerId))?.trim());
    return `${providerId}:${hasKey ? "key" : "nokey"}`;
  }

  private async resolveApiKey(providerId: string): Promise<string | undefined> {
    const fromSecret = await this.apiKeyRepository.get(providerId as ProviderId);
    if (fromSecret?.trim()) {
      return fromSecret.trim();
    }
    const cfg = await this.configurationManager.getProviderConfig(providerId);
    const fromConfig = cfg?.apiKey;
    return typeof fromConfig === "string" && fromConfig.trim() ? fromConfig.trim() : undefined;
  }
}
