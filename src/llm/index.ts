import type { LLMProvider, GenerateParams, GenerateResult } from "./types";
import { ZAiProvider } from "./providers/zai";
import { OpenRouterProvider } from "./providers/openrouter";
import { GoogleAIStudioProvider } from "./providers/google-ai-studio";
import { CohereProvider } from "./providers/cohere";
import { HuggingFaceProvider } from "./providers/huggingface";
import type { SecretStorage } from "vscode";

export type ProviderId =
  | "gemini"
  | "zai"
  | "openrouter"
  | "google-ai-studio"
  | "cohere"
  | "huggingface";

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor(
    private secrets: SecretStorage,
    private settings: { zaiBaseUrl?: string; googleAIEndpoint?: string },
  ) {
    // Register GoogleAIStudioProvider for both "google-ai-studio" and "gemini" IDs
    const googleAIStudioProvider = new GoogleAIStudioProvider(
      settings.googleAIEndpoint === "native",
    );
    this.providers.set("google-ai-studio", googleAIStudioProvider);

    // Register the same provider instance with "gemini" ID for backward compatibility
    this.providers.set("gemini", new GoogleAIStudioProvider(true, "gemini")); // Use native endpoint for gemini

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

  async generate(providerId: ProviderId, params: GenerateParams): Promise<GenerateResult> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);

    // Handle API key migration from "gemini" to "google-ai-studio"
    let apiKey = await this.secrets.get(this.keyName(providerId));

    // If using "google-ai-studio" but no key found, check for legacy "gemini" key
    if (providerId === "google-ai-studio" && !apiKey) {
      const legacyKey = await this.secrets.get(this.keyName("gemini"));
      if (legacyKey) {
        // Migrate the key to the new location
        await this.secrets.store(this.keyName("google-ai-studio"), legacyKey);
        apiKey = legacyKey;
      }
    }

    return provider.generate(params, apiKey || undefined);
  }

  async setApiKey(providerId: ProviderId, key: string) {
    // When setting a "gemini" key, also store it as "google-ai-studio" for migration
    await this.secrets.store(this.keyName(providerId), key);

    if (providerId === "gemini") {
      await this.secrets.store(this.keyName("google-ai-studio"), key);
    }
  }

  async deleteApiKey(providerId: ProviderId) {
    // When deleting a "gemini" key, also delete the migrated "google-ai-studio" key
    await this.secrets.delete(this.keyName(providerId));

    if (providerId === "gemini") {
      await this.secrets.delete(this.keyName("google-ai-studio"));
    }
  }

  async hasApiKey(providerId: ProviderId) {
    let key = await this.secrets.get(this.keyName(providerId));

    // For "google-ai-studio", also check for migrated "gemini" key
    if (providerId === "google-ai-studio" && !key) {
      key = await this.secrets.get(this.keyName("gemini"));
    }

    return Boolean(key);
  }

  async getApiKey(providerId: ProviderId) {
    let key = await this.secrets.get(this.keyName(providerId));

    // For "google-ai-studio", also check for migrated "gemini" key
    if (providerId === "google-ai-studio" && !key) {
      key = await this.secrets.get(this.keyName("gemini"));
    }

    return key;
  }

  private keyName(id: ProviderId) {
    return `qwiki:apikey:${id}`;
  }
}
