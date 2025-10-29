import type { LLMProvider } from "../types";
import { ProviderCapabilities, ProviderFeature } from "../types/ProviderCapabilities";
import { ZAiProvider } from "./zai";
import { OpenRouterProvider } from "./openrouter";
import { GoogleAIStudioProvider } from "./google-ai-studio";
import { CohereProvider } from "./cohere";
import { HuggingFaceProvider } from "./huggingface";

export type GetSetting = (key: string) => Promise<any>;

let providers: Record<string, LLMProvider> = {};

export function loadProviders(getSetting: GetSetting): Record<string, LLMProvider> {
  providers = {};

  providers["google-ai-studio"] = new GoogleAIStudioProvider(getSetting);
  providers["zai"] = new ZAiProvider(getSetting);
  providers["openrouter"] = new OpenRouterProvider();
  providers["cohere"] = new CohereProvider();
  providers["huggingface"] = new HuggingFaceProvider();

  return providers;
}

export function getProviderCapabilities(providerId: string): ProviderCapabilities | null {
  const provider = providers[providerId];
  return provider ? provider.capabilities : null;
}

export function getAllProviderCapabilities(): Record<string, ProviderCapabilities> {
  const result: Record<string, ProviderCapabilities> = {};

  for (const [providerId, provider] of Object.entries(providers)) {
    result[providerId] = provider.capabilities;
  }

  return result;
}

export function findProvidersWithCapability(capability: ProviderFeature): string[] {
  const result: string[] = [];

  for (const [providerId, provider] of Object.entries(providers)) {
    if (provider.supportsCapability(capability)) {
      result.push(providerId);
    }
  }

  return result;
}
