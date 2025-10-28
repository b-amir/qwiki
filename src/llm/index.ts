import type { LLMProvider, GenerateParams, GenerateResult } from "./types";
import { ZAiProvider } from "./providers/zai";
import { OpenRouterProvider } from "./providers/openrouter";
import { GoogleAIStudioProvider } from "./providers/google-ai-studio";
import { CohereProvider } from "./providers/cohere";
import { HuggingFaceProvider } from "./providers/huggingface";
import type { SecretStorage } from "vscode";
import { getAllProviderConfigs, type ProviderConfig } from "./provider-config";

export type ProviderId = "zai" | "openrouter" | "google-ai-studio" | "cohere" | "huggingface";

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor(
    private secrets: SecretStorage,
    private settings: { zaiBaseUrl?: string; googleAIEndpoint?: string },
  ) {
    // Register GoogleAIStudioProvider for "google-ai-studio" ID
    const googleAIStudioProvider = new GoogleAIStudioProvider(
      settings.googleAIEndpoint === "native",
    );
    this.providers.set("google-ai-studio", googleAIStudioProvider);

    this.providers.set("zai", new ZAiProvider(settings.zaiBaseUrl));
    this.providers.set("openrouter", new OpenRouterProvider());
    this.providers.set("cohere", new CohereProvider());
    this.providers.set("huggingface", new HuggingFaceProvider());
  }

  list() {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      models: p.listModels?.() || [],
    }));
  }

  /**
   * Get all provider configurations
   * @returns Array of all provider configurations
   */
  getProviderConfigs(): ProviderConfig[] {
    return getAllProviderConfigs(this.settings);
  }

  /**
   * Get configuration for a specific provider
   * @param providerId The ID of the provider
   * @returns Configuration for the specified provider or undefined if not found
   */
  getProviderConfig(providerId: string): ProviderConfig | undefined {
    return getAllProviderConfigs(this.settings).find((config) => config.id === providerId);
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
