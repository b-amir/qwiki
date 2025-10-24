import type { LLMProvider, GenerateParams, GenerateResult } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { ZAiProvider } from "./providers/zai";
import type { SecretStorage } from "vscode";

export type ProviderId = "gemini" | "zai";

export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor(private secrets: SecretStorage, private settings: { zaiBaseUrl?: string }) {
    this.providers.set("gemini", new GeminiProvider());
    this.providers.set("zai", new ZAiProvider(settings.zaiBaseUrl));
  }

  list() {
    return Array.from(this.providers.values()).map((p) => ({ id: p.id, name: p.name, models: p.listModels?.() || [] }));
  }

  async generate(providerId: ProviderId, params: GenerateParams): Promise<GenerateResult> {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);
    const apiKey = await this.secrets.get(this.keyName(providerId));
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

  private keyName(id: ProviderId) {
    return `qwiki:apikey:${id}`;
  }
}
