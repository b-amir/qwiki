import type { LLMProvider, GenerateParams, GenerateResult, ProviderId } from "./types";
import type { SecretStorage } from "vscode";
import { getAllProviderConfigs, type ProviderConfig } from "./provider-config";
import { loadProviders, type GetSetting } from "./providers/registry";

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor(
    private secrets: SecretStorage,
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
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);

    let apiKey = await this.secrets.get(this.keyName(providerId));
    return provider.generate(params, apiKey || undefined);
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
