import type { LLMProvider, ProviderUiConfig } from "./types";
import { ZAiProvider } from "./providers/zai";
import { OpenRouterProvider } from "./providers/openrouter";
import { GoogleAIStudioProvider } from "./providers/google-ai-studio";
import { CohereProvider } from "./providers/cohere";
import { HuggingFaceProvider } from "./providers/huggingface";
import type { SecretStorage } from "vscode";

export interface ProviderConfig {
  id: string;
  name: string;
  apiKeyUrl: string;
  apiKeyInput: string;
  additionalInfo?: string;
  hasEndpointType?: boolean;
  modelFallbackIds?: string[];
}

// Create provider instances with default settings
const createProviderInstances = (settings: { zaiBaseUrl?: string; googleAIEndpoint?: string }) => {
  const googleAIStudioProvider = new GoogleAIStudioProvider(settings.googleAIEndpoint === "native");

  return {
    zai: new ZAiProvider(settings.zaiBaseUrl),
    openrouter: new OpenRouterProvider(),
    "google-ai-studio": googleAIStudioProvider,
    cohere: new CohereProvider(),
    huggingface: new HuggingFaceProvider(),
  };
};

/**
 * Get all provider configurations
 * @param settings Optional settings object for provider initialization
 * @returns Array of all provider configurations
 */
export function getAllProviderConfigs(
  settings: { zaiBaseUrl?: string; googleAIEndpoint?: string } = {},
): ProviderConfig[] {
  const providers = createProviderInstances(settings);

  return Object.entries(providers).map(([id, provider]) => {
    const uiConfig = provider.getUiConfig?.() || {};

    return {
      id,
      name: provider.name,
      apiKeyUrl: uiConfig.apiKeyUrl || "",
      apiKeyInput: uiConfig.apiKeyInput || "",
      additionalInfo: uiConfig.additionalInfo,
      hasEndpointType: uiConfig.hasEndpointType,
      modelFallbackIds: uiConfig.modelFallbackIds || [],
    };
  });
}

/**
 * Get configuration for a specific provider
 * @param providerId The ID of the provider
 * @param settings Optional settings object for provider initialization
 * @returns Configuration for the specified provider or undefined if not found
 */
export function getProviderConfig(
  providerId: string,
  settings: { zaiBaseUrl?: string; googleAIEndpoint?: string } = {},
): ProviderConfig | undefined {
  const providers = createProviderInstances(settings);
  const provider = providers[providerId as keyof typeof providers];

  if (!provider) {
    return undefined;
  }

  const uiConfig = provider.getUiConfig?.() || {};

  return {
    id: providerId,
    name: provider.name,
    apiKeyUrl: uiConfig.apiKeyUrl || "",
    apiKeyInput: uiConfig.apiKeyInput || "",
    additionalInfo: uiConfig.additionalInfo,
    hasEndpointType: uiConfig.hasEndpointType,
    modelFallbackIds: uiConfig.modelFallbackIds || [],
  };
}
