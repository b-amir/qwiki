<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { vscode } from "@/utilities/vscode";

const wiki = useWikiStore();
const settings = useSettingsStore();
const settingsLoading = ref(false);

const centralizedProviderConfigs = ref<
  Array<{
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
  }>
>([]);

const providerConfigs = computed(() => {
  return centralizedProviderConfigs.value.map((config) => {
    const wikiProvider = wiki.providers.find((p) => p.id === config.id);

    return {
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
    };
  });
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

const getApiKeyInput = (providerId: string) => {
  return settings.apiKeyInputs[providerId] || "";
};

const getCustomFieldValue = (fieldId: string) => {
  return settings.customSettings[fieldId] || "";
};

const handleProviderChange = (providerId: string) => {
  wiki.providerId = providerId;
  settings.autoSaveProviderSelection(providerId);
};

const handleApiKeyChange = (providerId: string, newValue: string) => {
  const config = providerConfigs.value.find((p) => p.id === providerId);
  if (config) {
    settings.apiKeyInputs[providerId] = newValue;
    settings.trackApiKeyChange(providerId, newValue);
    settings.autoSaveApiKey(providerId, newValue);
  }
};

const handleCustomFieldChange = (fieldId: string, newValue: string) => {
  settings.saveSetting(fieldId, newValue);
};

const initSettings = async () => {
  if (!settings.initialized) {
    settingsLoading.value = true;
    try {
      await settings.init();
    } catch (error) {
      console.error("[QWIKI]", "Failed to initialize settings:", error);
    } finally {
      settingsLoading.value = false;
    }
  }

  vscode.postMessage({ command: "getProviders" });
  vscode.postMessage({ command: "getProviderConfigs" });
};

const setupMessageListener = () => {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    switch (message.command) {
      case "providerConfigs": {
        centralizedProviderConfigs.value = message.payload || [];
        nextTick(() => {
          setTimeout(() => {
            providerConfigs.value.forEach((provider) => {
              calculateContentHeight(provider.id);
            });
          }, 50);
        });
        break;
      }
    }
  };

  window.addEventListener("message", handleMessage);

  setTimeout(() => {
    if (centralizedProviderConfigs.value.length === 0) {
      console.error("[QWIKI]", "Provider configs not received within timeout");
    }
  }, 5000);
};

watch(
  () => settings.selectedProvider,
  (newProviderId) => {
    if (newProviderId) {
      nextTick(() => {
        calculateContentHeight(newProviderId);
      });

      if (!wiki.model) {
        const provider = providerConfigs.value.find((p) => p.id === newProviderId);
        if (provider?.defaultModel) {
          wiki.model = provider.defaultModel;
        } else {
          const models = getModelsForProvider(newProviderId, provider?.modelFallbackIds);
          if (models.length > 0) {
            wiki.model = models[0];
          }
        }
      }
    }
  },
);

const contentHeights = ref<Record<string, number>>({});

const calculateContentHeight = async (providerId: string) => {
  await nextTick();
  const element = document.getElementById(`provider-content-${providerId}`);
  if (element) {
    contentHeights.value[providerId] = element.scrollHeight;
  }
};

onMounted(() => {
  setupMessageListener();
  initSettings();

  setTimeout(() => {
    providerConfigs.value.forEach((provider) => {
      calculateContentHeight(provider.id);
    });
  }, 100);

  setTimeout(() => {
    if (centralizedProviderConfigs.value.length === 0) {
      centralizedProviderConfigs.value = [];
    }
  }, 5000);
});
</script>

<template>
  <div class="settings-shell mx-auto max-w-3xl space-y-8 px-6 py-10">
    <div
      v-if="settingsLoading || settings.loading"
      class="border-border bg-muted/20 rounded-2xl border p-8 shadow-sm"
    >
      <LoadingState
        :steps="[
          { text: 'Loading settings...', key: 'loading' },
          { text: 'Fetching providers...', key: 'fetching' },
          { text: 'Preparing configuration...', key: 'preparing' },
        ]"
        :current-step="'loading'"
        density="low"
      />
    </div>

    <section v-else class="border-border bg-background rounded-2xl border shadow-sm">
      <div class="space-y-6 px-6 py-6 sm:px-8">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                class="text-foreground"
              >
                <path
                  d="M4 15.8294V15.75V8C4 7.69114 4.16659 7.40629 4.43579 7.25487L4.45131 7.24614L11.6182 3.21475L11.6727 3.18411C11.8759 3.06979 12.1241 3.06979 12.3273 3.18411L19.6105 7.28092C19.8511 7.41625 20 7.67083 20 7.94687V8V15.75V15.8294C20 16.1119 19.8506 16.3733 19.6073 16.5167L12.379 20.7766C12.1451 20.9144 11.8549 20.9144 11.621 20.7766L4.39267 16.5167C4.14935 16.3733 4 16.1119 4 15.8294Z"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path d="M12 21V12" stroke="currentColor" stroke-width="2" />
                <path d="M12 12L4 7.5" stroke="currentColor" stroke-width="2" />
                <path d="M20 7.5L12 12" stroke="currentColor" stroke-width="2" />
              </svg>
              <h2 class="text-foreground text-lg font-semibold">Providers</h2>
            </div>
            <p class="text-muted-foreground text-xs">
              Choose the models and credentials that power your wiki.
            </p>
          </div>
          <span
            v-if="settings.loadingProviders"
            class="text-muted-foreground text-xs font-medium uppercase tracking-wide"
          >
            Refreshing providers
          </span>
        </div>

        <div v-if="settings.loadingProviders || !providerConfigs.length">
          <LoadingState
            :steps="[
              { text: 'Loading settings...', key: 'loading' },
              { text: 'Fetching providers...', key: 'fetching' },
              { text: 'Preparing configuration...', key: 'preparing' },
            ]"
            :current-step="'fetching'"
            density="low"
          />
        </div>

        <div v-else class="space-y-4">
          <h3 class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            LLM Provider
          </h3>

          <div class="space-y-3">
            <div
              v-for="provider in providerConfigs"
              :key="provider.id"
              class="hover:border-primary hover:bg-muted/90 focus-within:border-primary group overflow-clip rounded-xl border border-transparent"
              :class="{
                'bg-foreground border-transparent shadow-sm focus-within:border-transparent':
                  settings.selectedProvider === provider.id,
                'bg-muted': settings.selectedProvider !== provider.id,
              }"
              :style="{
                transition: 'background-color 0.08s ease-out, border-color 0.08s ease-out',
                willChange: 'background-color, border-color',
              }"
            >
              <div
                class="flex cursor-pointer select-none items-center gap-3 px-4 py-3"
                @click="handleProviderChange(provider.id)"
              >
                <div class="relative flex items-center">
                  <input
                    :id="`${provider.id}-provider`"
                    v-model="settings.selectedProvider"
                    type="radio"
                    :value="provider.id"
                    class="sr-only"
                    @change="handleProviderChange(provider.id)"
                  />
                  <div
                    class="flex h-4 w-4 items-center justify-center rounded-full border-2"
                    :class="
                      settings.selectedProvider === provider.id
                        ? 'border-primary bg-primary ring-primary/20 ring-2'
                        : 'border-muted-foreground group-hover:border-primary'
                    "
                  >
                    <div
                      v-if="settings.selectedProvider === provider.id"
                      class="bg-background h-2 w-2 rounded-full"
                    />
                  </div>
                </div>
                <label
                  :for="`${provider.id}-provider`"
                  class="cursor-pointer text-sm font-medium"
                  :class="
                    settings.selectedProvider === provider.id
                      ? 'text-background'
                      : 'text-foreground'
                  "
                >
                  {{ provider.name }}
                </label>
              </div>
              <div
                class="overflow-hidden"
                :style="{
                  height:
                    settings.selectedProvider === provider.id
                      ? `${contentHeights[provider.id] || 0}px`
                      : '0px',
                  transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'height',
                }"
              >
                <div
                  v-show="settings.selectedProvider === provider.id"
                  :id="`provider-content-${provider.id}`"
                  class="border-border bg-background border-t px-4 pb-5 pt-3 text-sm"
                  :style="{
                    opacity: settings.selectedProvider === provider.id ? 1 : 0,
                    transition: 'opacity 0.15s ease-out 0.05s',
                    transform:
                      settings.selectedProvider === provider.id
                        ? 'translateY(0)'
                        : 'translateY(-8px)',
                    willChange: 'opacity, transform',
                  }"
                  @vue:mounted="calculateContentHeight(provider.id)"
                >
                  <div class="space-y-4">
                    <div class="space-y-2">
                      <label class="text-muted-foreground text-xs font-medium tracking-wide">
                        Model
                      </label>
                      <select
                        v-model="wiki.model"
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full appearance-none rounded-lg border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option
                          v-for="m in getModelsForProvider(provider.id, provider.modelFallbackIds)"
                          :key="m"
                          :value="m"
                        >
                          {{ m }}
                        </option>
                      </select>
                    </div>

                    <div class="space-y-2">
                      <label class="text-muted-foreground text-xs font-medium tracking-wide">
                        API Key
                      </label>
                      <input
                        :value="getApiKeyInput(provider.id)"
                        type="password"
                        placeholder="Enter your API key"
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        @input="
                          handleApiKeyChange(provider.id, ($event.target as HTMLInputElement).value)
                        "
                      />
                    </div>

                    

                    <div v-for="field in provider.customFields" :key="field.id" class="space-y-2">
                      <label class="text-muted-foreground text-xs font-medium tracking-wide">
                        {{ field.label }}
                      </label>
                      <input
                        v-if="field.type === 'text'"
                        :value="getCustomFieldValue(field.id)"
                        type="text"
                        :placeholder="field.placeholder"
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        @input="
                          handleCustomFieldChange(
                            field.id,
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                      />
                      <select
                        v-else-if="field.type === 'select'"
                        :value="getCustomFieldValue(field.id)"
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full appearance-none rounded-lg border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        @change="
                          handleCustomFieldChange(
                            field.id,
                            ($event.target as HTMLSelectElement).value,
                          )
                        "
                      >
                        <option v-for="option in field.options" :key="option" :value="option">
                          {{ option }}
                        </option>
                      </select>
                    </div>

                    <div class="pt-1">
                      <a
                        :href="provider.apiKeyUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:text-primary/80 text-xs font-medium underline underline-offset-4"
                      >
                        Get API key ->
                      </a>
                    </div>

                    <p v-if="provider.additionalInfo" class="text-muted-foreground text-xs">
                      {{ provider.additionalInfo }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer class="border-border bg-muted/10 text-muted-foreground border-t px-6 py-4 text-xs">
        Keys are stored securely in VS Code Secret Storage.
      </footer>
    </section>
  </div>
</template>
