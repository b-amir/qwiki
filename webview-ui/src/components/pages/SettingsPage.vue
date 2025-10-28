<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { vscode } from "@/utilities/vscode";

const wiki = useWikiStore();
const settings = useSettingsStore();
const settingsLoading = ref(false);

// Store provider configurations from the centralized system
const centralizedProviderConfigs = ref<
  Array<{
    id: string;
    name: string;
    apiKeyUrl: string;
    apiKeyInput: string;
    additionalInfo?: string;
    hasEndpointType?: boolean;
    modelFallbackIds?: string[];
  }>
>([]);

// Get provider configurations from centralized system
const providerConfigs = computed(() => {
  return centralizedProviderConfigs.value.map((config) => {
    // Check if this provider exists in wiki providers
    const wikiProvider = wiki.providers.find((p) => p.id === config.id);

    return {
      id: config.id,
      name: config.name,
      apiKeyUrl: config.apiKeyUrl,
      apiKeyInput: config.apiKeyInput,
      additionalInfo: config.additionalInfo,
      hasEndpointType: config.hasEndpointType,
      modelFallbackIds: config.modelFallbackIds,
      // Include wiki provider data if available
      hasKey: wikiProvider?.hasKey || false,
      models: wikiProvider?.models || [],
    };
  });
});

// Get models for a specific provider with fallback support
const getModelsForProvider = (providerId: string, fallbackIds?: string[]) => {
  const provider = wiki.providers.find((p) => p.id === providerId);
  if (provider?.models?.length) return provider.models;

  // Check fallback providers if specified
  if (fallbackIds) {
    for (const fallbackId of fallbackIds) {
      const fallbackProvider = wiki.providers.find((p) => p.id === fallbackId);
      if (fallbackProvider?.models?.length) return fallbackProvider.models;
    }
  }

  return [];
};

// Get API key input value for a provider
const getApiKeyInput = (providerId: string) => {
  const config = providerConfigs.value.find((p) => p.id === providerId);
  return config ? (settings as any)[config.apiKeyInput] : "";
};

// Handle provider selection change
const handleProviderChange = (providerId: string) => {
  wiki.providerId = providerId;
  settings.autoSaveProviderSelection(providerId);
};

// Handle API key change with auto-save
const handleApiKeyChange = (providerId: string, newValue: string) => {
  const config = providerConfigs.value.find((p) => p.id === providerId);
  if (config) {
    settings.trackApiKeyChange(providerId, newValue);
    settings.autoSaveApiKey(providerId, newValue);
  }
};

// Initialize settings when component is mounted
const initSettings = async () => {
  if (!settings.initialized) {
    settingsLoading.value = true;
    await settings.init();
    settingsLoading.value = false;
  }

  // Request providers for wiki store (needed for hasKey and models data)
  vscode.postMessage({ command: "getProviders" });

  // Request provider configurations from the extension
  vscode.postMessage({ command: "getProviderConfigs" });
};

// Set up message listener for provider configurations
const setupMessageListener = () => {
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "providerConfigs": {
        centralizedProviderConfigs.value = message.payload || [];
        // Calculate heights after providers are loaded
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
  });
};

// Watch for provider selection changes to recalculate heights
watch(
  () => settings.selectedProvider,
  (newProviderId) => {
    if (newProviderId) {
      nextTick(() => {
        calculateContentHeight(newProviderId);
      });
    }
  },
);

// Store the height of each provider content for smooth animations
const contentHeights = ref<Record<string, number>>({});

// Calculate the actual height of content elements
const calculateContentHeight = async (providerId: string) => {
  await nextTick();
  const element = document.getElementById(`provider-content-${providerId}`);
  if (element) {
    contentHeights.value[providerId] = element.scrollHeight;
  }
};

// Initialize on component mount
onMounted(() => {
  setupMessageListener();
  initSettings();

  // Calculate heights after providers are loaded
  setTimeout(() => {
    providerConfigs.value.forEach((provider) => {
      calculateContentHeight(provider.id);
    });
  }, 100);
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
            <h2 class="text-foreground text-lg font-semibold">Providers</h2>
            <p class="text-muted-foreground text-sm">
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

                    <div v-if="provider.hasEndpointType" class="space-y-2">
                      <label class="text-muted-foreground text-xs font-medium tracking-wide">
                        Endpoint Type
                      </label>
                      <select
                        v-model="settings.googleAIEndpoint"
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full appearance-none rounded-lg border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="openai-compatible">OpenAI Compatible</option>
                        <option value="native">Native</option>
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
