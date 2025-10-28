<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
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
        break;
      }
    }
  });
};

// Initialize on component mount
onMounted(() => {
  setupMessageListener();
  initSettings();
});
</script>

<template>
  <div class="space-y-4">
    <div v-if="settingsLoading || settings.loading" class="h-full">
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
    <div v-else class="space-y-4 px-3">
      <!-- Show loading state if provider configs are not loaded yet -->
      <div v-if="!centralizedProviderConfigs.length" class="h-full">
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

      <!-- Provider Selection with Radio Buttons -->
      <div v-else class="space-y-4">
        <h3 class="text-sm font-medium">LLM Provider</h3>

        <!-- Dynamic Provider Options -->
        <div
          v-for="provider in providerConfigs"
          :key="provider.id"
          class="space-y-3 rounded-md border p-3"
        >
          <div class="flex items-center space-x-2">
            <input
              :id="`${provider.id}-provider`"
              v-model="settings.selectedProvider"
              type="radio"
              :value="provider.id"
              class="h-4 w-4"
              @change="handleProviderChange(provider.id)"
            />
            <label :for="`${provider.id}-provider`" class="text-sm font-medium">{{
              provider.name
            }}</label>
          </div>

          <div v-if="settings.selectedProvider === provider.id" class="space-y-2 pl-6">
            <select
              v-model="wiki.model"
              class="bg-background w-full rounded border px-2 py-1 text-sm hover:[filter:brightness(1.1)]"
            >
              <option
                v-for="m in getModelsForProvider(provider.id, provider.modelFallbackIds)"
                :key="m"
                :value="m"
              >
                {{ m }}
              </option>
            </select>
            <input
              :value="getApiKeyInput(provider.id)"
              type="password"
              placeholder="API Key"
              class="bg-background w-full rounded border px-2 py-1 text-sm"
              @input="handleApiKeyChange(provider.id, ($event.target as HTMLInputElement).value)"
            />

            <!-- Google AI Studio Endpoint Type Selection -->
            <div v-if="provider.hasEndpointType" class="space-y-1">
              <label class="text-muted-foreground text-xs">Endpoint Type:</label>
              <select
                v-model="settings.googleAIEndpoint"
                class="bg-background w-full rounded border px-2 py-1 text-sm"
              >
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="native">Native</option>
              </select>
            </div>

            <a
              :href="provider.apiKeyUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary text-xs underline"
            >
              Get API key from {{ provider.name }}
            </a>

            <!-- Additional Information -->
            <p v-if="provider.additionalInfo" class="text-muted-foreground text-xs">
              {{ provider.additionalInfo }}
            </p>
          </div>
        </div>
      </div>

      <p class="text-muted-foreground text-xs">
        Keys are stored securely in VS Code Secret Storage.
      </p>
    </div>
  </div>
</template>
