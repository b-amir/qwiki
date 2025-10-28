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
  defaultModel?: string;
  customFields?: import("./types").ProviderCustomField[];
}

const createProviderInstances = (settings: { zaiBaseUrl?: string; googleAIEndpoint?: string }) => {
  const googleAIStudioProvider = new GoogleAIStudioProvider(settings.googleAIEndpoint === "native");

  return {
    "google-ai-studio": googleAIStudioProvider,
    zai: new ZAiProvider(settings.zaiBaseUrl),
    openrouter: new OpenRouterProvider(),
    cohere: new CohereProvider(),
    huggingface: new HuggingFaceProvider(),
  };
};

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
      defaultModel: uiConfig.defaultModel,
      customFields: uiConfig.customFields,
    };
  });
}

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
    defaultModel: uiConfig.defaultModel,
    customFields: uiConfig.customFields,
  };
}
