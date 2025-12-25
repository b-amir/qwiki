import { EventBus } from "@/events";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import type { ConfigurationRepository } from "@/domain/repositories/ConfigurationRepository";
import type { ProviderConfiguration } from "@/domain/configuration";
import type { ConfigurationValidationEngineService } from "@/application/services/configuration/ConfigurationValidationEngineService";
import type { LLMRegistry } from "@/llm";
import { ConfigurationValidator } from "@/application/services/configuration/validation/ConfigurationValidator";

export class ProviderConfigurationManager {
  private logger: Logger;

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
    private validationEngine: ConfigurationValidationEngineService,
    private validator: ConfigurationValidator,
    private cacheManager: {
      has: (key: string) => boolean;
      get: <T>(key: string) => T | undefined;
      set: <T>(key: string, value: T) => void;
    },
    private llmRegistry?: LLMRegistry,
    loggingService?: LoggingService,
  ) {
    this.logger = loggingService
      ? createLogger("ProviderConfigurationManager")
      : {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        };
  }

  setLlmRegistry(llmRegistry: LLMRegistry): void {
    this.llmRegistry = llmRegistry;
  }

  async getProviderConfig(providerId: string): Promise<ProviderConfiguration | undefined> {
    const cacheKey = `provider.${providerId}`;
    if (this.cacheManager.has(cacheKey)) {
      return this.cacheManager.get<ProviderConfiguration>(cacheKey);
    }

    const config = await this.configurationRepository.get<ProviderConfiguration>(cacheKey);
    if (config) {
      this.cacheManager.set(cacheKey, config);
    }
    return config;
  }

  async setProviderConfig(providerId: string, config: ProviderConfiguration): Promise<void> {
    let availableModels: string[] | undefined;

    if (this.llmRegistry) {
      try {
        const provider = this.llmRegistry.getProvider(providerId);
        if (provider) {
          availableModels = provider.listModels();
        }
      } catch (error) {
        this.logger.warn(`Could not get models for provider ${providerId}`, error);
      }
    }

    const validationResult = this.validationEngine.validateProviderConfig(
      providerId,
      config,
      availableModels,
    );

    this.validator.throwIfInvalid(validationResult, providerId);

    if (validationResult.warnings.length > 0) {
      const warningMessages = validationResult.warnings.map((w) => w.message).join(", ");
      this.logger.warn(`Configuration warnings for ${providerId}: ${warningMessages}`);
    }

    const cacheKey = `provider.${providerId}`;
    const configWithoutApiKey = { ...config };
    if (configWithoutApiKey.apiKey !== undefined) {
      delete configWithoutApiKey.apiKey;
      this.logger.warn(
        `API key in provider config for ${providerId} was removed. API keys must be stored in SecretStorage only.`,
      );
    }
    await this.configurationRepository.set(cacheKey, configWithoutApiKey);
    this.cacheManager.set(cacheKey, configWithoutApiKey);

    await this.eventBus.publish("providerConfigChanged", {
      providerId,
      config: configWithoutApiKey,
    });
  }
}
