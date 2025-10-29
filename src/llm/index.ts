import type { LLMProvider, GenerateParams, GenerateResult, ProviderId } from "./types";
import type { SecretStorage } from "vscode";
import { getAllProviderConfigs, type ProviderConfig } from "./provider-config";
import { loadProviders, type GetSetting } from "./providers/registry";
import { ErrorRecoveryService, ErrorLoggingService } from "../infrastructure/services";
import { ProviderError, ErrorCodes } from "../errors";

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor(
    private secrets: SecretStorage,
    private errorRecoveryService: ErrorRecoveryService,
    getSetting?: GetSetting,
  ) {
    const allProviders = loadProviders(getSetting || (async () => undefined));

    for (const [id, provider] of Object.entries(allProviders)) {
      this.providers.set(id, provider);
    }
  }

  list() {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      models: p.listModels?.() || [],
    }));
  }

  getProviderConfigs(getSetting?: GetSetting): ProviderConfig[] {
    return getAllProviderConfigs(getSetting);
  }

  getProviderConfig(providerId: string, getSetting?: GetSetting): ProviderConfig | undefined {
    return getAllProviderConfigs(getSetting).find((config) => config.id === providerId);
  }

  getProvider(providerId: ProviderId) {
    return this.providers.get(providerId);
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

    let apiKey = await this.secrets.get(this.keyName(providerId));

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
}
