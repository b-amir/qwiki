import type { LLMProvider } from "./types";
import { loadProviders, type GetSetting } from "./providers/registry";

export interface ProviderConfig {
  id: string;
  name: string;
  apiKeyUrl: string;
  apiKeyInput: string;
  additionalInfo?: string;
  modelFallbackIds?: string[];
  defaultModel?: string;
  customFields?: import("./types").ProviderCustomField[];
}

const createProviderInstances = (getSetting?: GetSetting) =>
  loadProviders(getSetting || (async () => undefined));

export function getAllProviderConfigs(getSetting?: GetSetting): ProviderConfig[] {
  const providers = createProviderInstances(getSetting);

  return Object.entries(providers).map(([id, provider]) => {
    const uiConfig = (provider.getUiConfig?.() || {}) as import("./types").ProviderUiConfig;

    return {
      id,
      name: provider.name,
      apiKeyUrl: uiConfig.apiKeyUrl || "",
      apiKeyInput: uiConfig.apiKeyInput || "",
      additionalInfo: uiConfig.additionalInfo,
      modelFallbackIds: uiConfig.modelFallbackIds || [],
      defaultModel: uiConfig.defaultModel,
      customFields: uiConfig.customFields,
    };
  });
}

export function getProviderConfig(
  providerId: string,
  getSetting?: GetSetting,
): ProviderConfig | undefined {
  const providers = createProviderInstances(getSetting);
  const provider = providers[providerId as keyof typeof providers];

  if (!provider) {
    return undefined;
  }

  const uiConfig = (provider.getUiConfig?.() || {}) as import("./types").ProviderUiConfig;

  return {
    id: providerId,
    name: provider.name,
    apiKeyUrl: uiConfig.apiKeyUrl || "",
    apiKeyInput: uiConfig.apiKeyInput || "",
    additionalInfo: uiConfig.additionalInfo,
    modelFallbackIds: uiConfig.modelFallbackIds || [],
    defaultModel: uiConfig.defaultModel,
    customFields: uiConfig.customFields,
  };
}
