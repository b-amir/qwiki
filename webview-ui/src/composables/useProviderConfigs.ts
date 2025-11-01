import { computed, watch, nextTick, type Ref } from "vue";
import type { useWikiStore } from "@/stores/wiki";
import type { useSettingsStore } from "@/stores/settings";

interface ProviderConfig {
  id: string;
  name: string;
  apiKeyUrl: string;
  apiKeyInput: string;
  additionalInfo?: string;
  hasEndpointType?: boolean;
  modelFallbackIds?: string[];
  defaultModel?: string;
  customFields?: Array<{
    id: string;
    label: string;
    type: "text" | "select";
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
  }>;
  hasKey?: boolean;
  models?: string[];
}

export function useProviderConfigs(
  wiki: ReturnType<typeof useWikiStore>,
  settings: ReturnType<typeof useSettingsStore>,
  centralizedProviderConfigs: Ref<ProviderConfig[]>,
) {
  const providerConfigs = computed(() => {
    const wikiMap = new Map(wiki.providers.map((p) => [p.id, p]));
    const mergedProviders = new Map<string, any>();

    wiki.providers.forEach((p) => {
      mergedProviders.set(p.id, {
        id: p.id,
        name: p.name,
        apiKeyUrl: "",
        apiKeyInput: "",
        additionalInfo: undefined,
        hasEndpointType: false,
        modelFallbackIds: [],
        defaultModel: p.models?.[0],
        customFields: [],
        hasKey: p.hasKey,
        models: p.models || [],
      });
    });

    centralizedProviderConfigs.value.forEach((config) => {
      const existing = mergedProviders.get(config.id);
      if (existing) {
        mergedProviders.set(config.id, {
          ...existing,
          name: config.name || existing.name,
          apiKeyUrl: config.apiKeyUrl,
          apiKeyInput: config.apiKeyInput,
          additionalInfo: config.additionalInfo,
          hasEndpointType: config.hasEndpointType,
          modelFallbackIds: config.modelFallbackIds,
          defaultModel: config.defaultModel || existing.defaultModel,
          customFields: config.customFields,
        });
      } else {
        const wikiProvider = wikiMap.get(config.id);
        mergedProviders.set(config.id, {
          id: config.id,
          name: config.name,
          apiKeyUrl: config.apiKeyUrl,
          apiKeyInput: config.apiKeyInput,
          additionalInfo: config.additionalInfo,
          hasEndpointType: config.hasEndpointType,
          modelFallbackIds: config.modelFallbackIds,
          defaultModel: config.defaultModel,
          customFields: config.customFields,
          hasKey: wikiProvider?.hasKey || false,
          models: wikiProvider?.models || [],
        });
      }
    });

    return Array.from(mergedProviders.values());
  });

  const getModelsForProvider = (providerId: string, fallbackIds?: string[]) => {
    const provider = wiki.providers.find((p) => p.id === providerId);
    if (provider?.models?.length) return provider.models;

    if (fallbackIds) {
      for (const fallbackId of fallbackIds) {
        const fallbackProvider = wiki.providers.find((p) => p.id === fallbackId);
        if (fallbackProvider?.models?.length) return fallbackProvider.models;
      }
    }

    return [];
  };

  watch(
    () => settings.selectedProvider,
    (newProviderId) => {
      if (newProviderId) {
        nextTick(() => {
          const provider = providerConfigs.value.find((p) => p.id === newProviderId);
          if (provider) {
            if (!wiki.model) {
              if (provider.defaultModel) {
                wiki.model = provider.defaultModel;
              } else {
                const models = getModelsForProvider(newProviderId, provider.modelFallbackIds);
                if (models.length > 0) {
                  wiki.model = models[0];
                }
              }
            } else {
              const models = getModelsForProvider(newProviderId, provider.modelFallbackIds);
              if (!models.includes(wiki.model) && models.length > 0) {
                wiki.model = models[0];
              }
            }
          }
        });
      }
    },
    { immediate: true },
  );

  watch(
    () => providerConfigs.value,
    (newConfigs) => {
      if (newConfigs.length > 0 && settings.selectedProvider) {
        const provider = newConfigs.find((p) => p.id === settings.selectedProvider);
        if (provider && !wiki.model) {
          if (provider.defaultModel) {
            wiki.model = provider.defaultModel;
          } else {
            const models = getModelsForProvider(
              settings.selectedProvider,
              provider.modelFallbackIds,
            );
            if (models.length > 0) {
              wiki.model = models[0];
            }
          }
        }
      }
    },
    { immediate: true },
  );

  return { providerConfigs, getModelsForProvider };
}
