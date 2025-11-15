import type { LLMProvider, GenerateParams, GenerateResult, ProviderId } from "@/llm/types";
import type { SecretStorage } from "vscode";
import type { ConfigurationManagerService } from "@/application/services";
import type { ProviderConfiguration } from "@/domain/configuration";
import { getAllProviderConfigs, type ProviderConfig } from "@/llm/provider-config";
import { loadProviders, type GetSetting } from "@/llm/providers/registry";
import type { HealthCheckResult } from "@/llm/types/ProviderCapabilities";
import {
  ErrorRecoveryService,
  ErrorLoggingService,
  RateLimiterService,
} from "@/infrastructure/services";
import { ProviderError, ErrorCodes, RateLimitError } from "@/errors";

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor(
    private secrets: SecretStorage,
    private errorRecoveryService: ErrorRecoveryService,
    private errorLoggingService: ErrorLoggingService,
    private configurationManager: ConfigurationManagerService,
    private rateLimiterService?: RateLimiterService,
    getSetting?: GetSetting,
  ) {
    const allProviders = loadProviders(getSetting || (async () => undefined));

    for (const [id, provider] of Object.entries(allProviders)) {
      this.providers.set(id, provider);
    }
  }

  list() {
    return Array.from(this.providers.values()).map((p) => {
      let models: string[] = [];
      try {
        models = p.listModels?.() || [];
      } catch (error) {
        models = [];
      }
      return {
        id: p.id,
        name: p.name,
        models,
      };
    });
  }

  async getProviderConfigs(): Promise<ProviderConfig[]> {
    const allConfigs = await this.configurationManager.getAll();
    const providerConfigs: ProviderConfig[] = [];

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.startsWith("provider.") && value) {
        const providerId = key.replace("provider.", "");
        const providerConfig = value as ProviderConfiguration;

        const provider = this.providers.get(providerId);
        const providerName = provider?.name || providerConfig.name;

        const customFields = providerConfig.customFields
          ? Object.entries(providerConfig.customFields).map(([key, value]) => ({
              id: key,
              label: key,
              type: "text" as const,
              placeholder: `Enter ${key}`,
              defaultValue: typeof value === "string" ? value : String(value),
            }))
          : undefined;

        providerConfigs.push({
          id: providerId,
          name: providerName,
          apiKeyUrl: "",
          apiKeyInput: "",
          additionalInfo: customFields?.find((f) => f.id === "description")?.defaultValue,
          modelFallbackIds: providerConfig.fallbackProviderIds,
          defaultModel: providerConfig.model,
          customFields,
        });
      }
    }

    return providerConfigs;
  }

  async getProviderConfig(providerId: string): Promise<ProviderConfig | undefined> {
    const providerConfig = await this.configurationManager.getProviderConfig(providerId);

    if (!providerConfig) {
      return undefined;
    }

    const provider = this.providers.get(providerId);
    const providerName = provider?.name || providerConfig.name;

    const customFields = providerConfig.customFields
      ? Object.entries(providerConfig.customFields).map(([key, value]) => ({
          id: key,
          label: key,
          type: "text" as const,
          placeholder: `Enter ${key}`,
          defaultValue: typeof value === "string" ? value : String(value),
        }))
      : undefined;

    return {
      id: providerConfig.id,
      name: providerName,
      apiKeyUrl: "",
      apiKeyInput: "",
      additionalInfo: customFields?.find((f) => f.id === "description")?.defaultValue,
      modelFallbackIds: providerConfig.fallbackProviderIds,
      defaultModel: providerConfig.model,
      customFields,
    };
  }

  getProvider(providerId: ProviderId) {
    return this.providers.get(providerId);
  }

  getAllProviders(): Record<string, LLMProvider> {
    const result: Record<string, LLMProvider> = {};
    for (const [id, provider] of this.providers.entries()) {
      result[id] = provider;
    }
    return result;
  }

  async generate(providerId: ProviderId, params: GenerateParams): Promise<GenerateResult> {
    const startTime = Date.now();
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ProviderError(
        ErrorCodes.PROVIDER_NOT_FOUND,
        `Unknown provider: ${providerId}`,
        providerId,
      );
    }

    if (this.rateLimiterService) {
      try {
        await this.rateLimiterService.checkLimit(`provider:${providerId}`);
      } catch (error: unknown) {
        if (error instanceof RateLimitError) {
          const rateLimitError = new ProviderError(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            error.message,
            providerId,
            error,
          );
          (rateLimitError as any).waitTimeMs = error.waitTimeMs;
          throw rateLimitError;
        }
        throw error;
      }
    }

    let apiKey = await this.secrets.get(this.keyName(providerId));

    if (!apiKey) {
      const providerConfig = await this.configurationManager.getProviderConfig(providerId);
      apiKey = providerConfig?.apiKey;
    }

    const errorClassifier = (error: any): ProviderError => {
      if (error instanceof ProviderError) {
        return error;
      }
      return ProviderError.fromError(error, providerId);
    };

    try {
      const result = await this.errorRecoveryService.executeWithRetry(
        () => provider.generate(params, apiKey || undefined),
        errorClassifier,
        providerId,
      );

      const duration = Date.now() - startTime;
      this.errorLoggingService.logGenerationMetrics(providerId, true, duration);

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.errorLoggingService.logGenerationMetrics(providerId, false, duration);
      this.errorLoggingService.logError(errorClassifier(error));
      throw error;
    }
  }

  async *generateStream(providerId: ProviderId, params: GenerateParams): AsyncGenerator<string> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ProviderError(
        ErrorCodes.PROVIDER_NOT_FOUND,
        `Unknown provider: ${providerId}`,
        providerId,
      );
    }

    if (!provider.generateStream) {
      throw new ProviderError(
        ErrorCodes.GENERATION_FAILED,
        `Provider ${providerId} does not support streaming`,
        providerId,
      );
    }

    if (this.rateLimiterService) {
      try {
        await this.rateLimiterService.checkLimit(`provider:${providerId}`);
      } catch (error: unknown) {
        if (error instanceof RateLimitError) {
          const rateLimitError = new ProviderError(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            error.message,
            providerId,
            error,
          );
          (rateLimitError as any).waitTimeMs = error.waitTimeMs;
          throw rateLimitError;
        }
        throw error;
      }
    }

    let apiKey = await this.secrets.get(this.keyName(providerId));

    if (!apiKey) {
      const providerConfig = await this.configurationManager.getProviderConfig(providerId);
      apiKey = providerConfig?.apiKey;
    }

    try {
      for await (const chunk of provider.generateStream(params, apiKey || undefined)) {
        yield chunk;
      }
    } catch (error: any) {
      const providerError =
        error instanceof ProviderError ? error : ProviderError.fromError(error, providerId);
      this.errorLoggingService.logError(providerError);
      throw providerError;
    }
  }

  async setApiKey(providerId: ProviderId, key: string) {
    await this.secrets.store(this.keyName(providerId), key);
  }

  async deleteApiKey(providerId: ProviderId) {
    await this.secrets.delete(this.keyName(providerId));
  }

  async hasApiKey(providerId: ProviderId) {
    const key = await this.secrets.get(this.keyName(providerId));
    return Boolean(key);
  }

  async getApiKey(providerId: ProviderId) {
    return await this.secrets.get(this.keyName(providerId));
  }

  private keyName(id: ProviderId) {
    return `qwiki:apikey:${id}`;
  }

  async healthCheckProvider(providerId: ProviderId): Promise<HealthCheckResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      const now = Date.now();
      return {
        isHealthy: false,
        responseTime: 0,
        error: `Provider ${providerId} not found`,
        lastChecked: new Date(now),
      };
    }

    const start = Date.now();
    try {
      let apiKey = await this.secrets.get(this.keyName(providerId));
      if (!apiKey) {
        const providerConfig = await this.configurationManager.getProviderConfig(providerId);
        apiKey = providerConfig?.apiKey;
      }

      return await this.healthCheckProviderWithKey(providerId, apiKey || undefined);
    } catch (error: any) {
      const responseTime = Date.now() - start;
      return {
        isHealthy: false,
        responseTime,
        error: error?.message || String(error),
        lastChecked: new Date(),
      };
    }
  }

  async healthCheckProviderWithKey(
    providerId: ProviderId,
    apiKey?: string,
  ): Promise<HealthCheckResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        isHealthy: false,
        responseTime: 0,
        error: `Provider ${providerId} not found`,
        lastChecked: new Date(),
      };
    }

    const start = Date.now();
    try {
      const maybeWithKey = (provider as any).healthCheckWithKey as
        | ((apiKey?: string) => Promise<HealthCheckResult>)
        | undefined;

      if (maybeWithKey) {
        const res = await maybeWithKey.call(provider, apiKey);
        if (typeof res.responseTime !== "number") {
          res.responseTime = Date.now() - start;
        }
        if (!res.lastChecked) res.lastChecked = new Date();
        return res;
      }

      const res = await provider.healthCheck();
      if (typeof res.responseTime !== "number") {
        res.responseTime = Date.now() - start;
      }
      if (!res.lastChecked) res.lastChecked = new Date();
      return res;
    } catch (error: any) {
      const responseTime = Date.now() - start;
      return {
        isHealthy: false,
        responseTime,
        error: error?.message || String(error),
        lastChecked: new Date(),
      };
    }
  }
}
