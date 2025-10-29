import type { LLMProvider } from "../llm/types";
import { loadProviders, type GetSetting } from "../llm/providers/registry";

export interface LLMProviderSettings {}

export class LLMProviderFactory {
  static createProvider(
    providerId: string,
    _settings: LLMProviderSettings = {},
  ): LLMProvider | undefined {
    const providers = loadProviders(async () => undefined);
    return providers[providerId];
  }

  static createAllProviders(_settings: LLMProviderSettings = {}): Record<string, LLMProvider> {
    return loadProviders(async () => undefined);
  }
}
