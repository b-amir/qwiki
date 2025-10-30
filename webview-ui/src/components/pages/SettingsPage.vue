<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import { vscode } from "@/utilities/vscode";

const wiki = useWikiStore();
const settings = useSettingsStore();
const navigationStatus = useNavigationStatusStore();
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

const providerCapabilities = ref<Record<string, any>>({});
const validating = ref(false);
const lastValidationValid = ref<boolean | null>(null);
const showValidationErrors = ref(false);
const validationErrors = ref<string[]>([]);
const validationWarnings = ref<string[]>([]);

const providerConfigs = computed(() => {
  if (centralizedProviderConfigs.value.length > 0) {
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
  }

  return wiki.providers.map((p) => ({
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
  }));
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
  const input = settings.apiKeyInputs[providerId] || "";

  const hasSavedKey =
    settings.originalApiKeys[providerId] &&
    settings.originalApiKeys[providerId].length > 0 &&
    input === settings.originalApiKeys[providerId];
  return hasSavedKey
    ? "•".repeat(Math.min(settings.originalApiKeys[providerId].length, 20))
    : input;
};

const getProviderCapability = (providerId: string, capability: string) => {
  return providerCapabilities.value[providerId]?.[capability] || false;
};

const validateCurrentConfiguration = () => {
  const validationStartTime = Date.now();
  console.log(
    `[QWIKI] Settings: Validating configuration for provider ${settings.selectedProvider}`,
  );

  try {
    const selectedProviderConfig = providerConfigs.value.find(
      (p) => p.id === settings.selectedProvider,
    );

    if (selectedProviderConfig) {
      const config = {
        id: selectedProviderConfig.id,
        name: selectedProviderConfig.name || settings.selectedProvider,
        enabled: true,
        apiKey: getApiKeyInput(settings.selectedProvider),
        model: wiki.model,
      };

      validating.value = true;
      lastValidationValid.value = null;
      settings.validateConfiguration(config, settings.selectedProvider);
      showValidationErrors.value = true;
      validationErrors.value = settings.validationErrors;
      validationWarnings.value = settings.validationWarnings;

      const validationEndTime = Date.now();
      console.log(
        `[QWIKI] Settings: Configuration validation completed in ${validationEndTime - validationStartTime}ms`,
      );
    } else {
      console.error(
        `[QWIKI] Settings: Selected provider config not found for ${settings.selectedProvider}`,
      );
    }
  } catch (error) {
    console.error(
      `[QWIKI] Settings: Error validating configuration for provider ${settings.selectedProvider}:`,
      error,
    );
  }
};

const getCustomFieldValue = (fieldId: string) => {
  return settings.customSettings[fieldId] || "";
};

const handleProviderChange = (providerId: string) => {
  const changeStartTime = Date.now();
  console.log(`[QWIKI] Settings: Changing provider to ${providerId}`);

  try {
    wiki.providerId = providerId;
    settings.autoSaveProviderSelection(providerId);

    const changeEndTime = Date.now();
    console.log(
      `[QWIKI] Settings: Provider change completed in ${changeEndTime - changeStartTime}ms`,
    );
  } catch (error) {
    console.error(`[QWIKI] Settings: Error changing provider to ${providerId}:`, error);
  }
};

const handleApiKeyChange = (providerId: string, newValue: string) => {
  const changeStartTime = Date.now();
  console.log(`[QWIKI] Settings: Updating API key for provider ${providerId}`);

  try {
    const config = providerConfigs.value.find((p) => p.id === providerId);
    if (config) {
      settings.apiKeyInputs[providerId] = newValue;
      settings.trackApiKeyChange(providerId, newValue);
      settings.autoSaveApiKey(providerId, newValue);

      const changeEndTime = Date.now();
      console.log(
        `[QWIKI] Settings: API key update completed in ${changeEndTime - changeStartTime}ms`,
      );
    } else {
      console.error(`[QWIKI] Settings: Provider config not found for ${providerId}`);
    }
  } catch (error) {
    console.error(`[QWIKI] Settings: Error updating API key for provider ${providerId}:`, error);
  }
};

const handleApiKeyFocus = (providerId: string) => {
  const input = settings.apiKeyInputs[providerId] || "";
  const hasSavedKey =
    settings.originalApiKeys[providerId] &&
    settings.originalApiKeys[providerId].length > 0 &&
    input.includes("•");
  if (hasSavedKey) {
    settings.apiKeyInputs[providerId] = settings.originalApiKeys[providerId];
  }
};

const handleApiKeyBlur = (providerId: string) => {
  const input = settings.apiKeyInputs[providerId] || "";
  const hasSavedKey =
    settings.originalApiKeys[providerId] &&
    settings.originalApiKeys[providerId].length > 0 &&
    input === settings.originalApiKeys[providerId];
  if (hasSavedKey) {
    settings.apiKeyInputs[providerId] = settings.originalApiKeys[providerId];
  }
};

const handleCustomFieldChange = (fieldId: string, newValue: string) => {
  settings.saveSetting(fieldId, newValue);
};

const openExternalUrl = (url: string) => {
  try {
    vscode.postMessage({
      command: "openExternal",
      payload: { url },
    });
  } catch (error) {
    console.error("[QWIKI] Settings: Failed to open external URL:", error);
  }
};

const initSettings = async () => {
  const initStartTime = Date.now();
  console.log("[QWIKI] Settings: Starting initialization");

  if (!settings.initialized) {
    settingsLoading.value = true;
    try {
      await settings.init();
      console.log("[QWIKI] Settings: Initialization completed successfully");
    } catch (error) {
      console.error("[QWIKI] Settings: Failed to initialize settings:", error);
    } finally {
      settingsLoading.value = false;
    }
  }

  console.log("[QWIKI] Settings: Fetching provider data");
  const providersStartTime = Date.now();

  try {
    vscode.postMessage({ command: "getProviders" });
    vscode.postMessage({ command: "getProviderConfigs" });
    settings.getProviderCapabilities();

    const providersEndTime = Date.now();
    console.log(
      `[QWIKI] Settings: Provider data requests sent in ${providersEndTime - providersStartTime}ms`,
    );
  } catch (error) {
    console.error("[QWIKI] Settings: Error fetching provider data:", error);
  }

  const initEndTime = Date.now();
  console.log(`[QWIKI] Settings: Total initialization time: ${initEndTime - initStartTime}ms`);
};

const setupMessageListener = () => {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data;
    const messageStartTime = Date.now();

    try {
      switch (message.command) {
        case "providerConfigs": {
          console.log(
            `[QWIKI] Settings: Received ${message.payload?.length || 0} provider configs`,
          );
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
        case "providerCapabilitiesRetrieved": {
          const capabilitiesCount = Object.keys(message.payload?.capabilities || {}).length;
          console.log(`[QWIKI] Settings: Received capabilities for ${capabilitiesCount} providers`);
          providerCapabilities.value = message.payload.capabilities || {};
          break;
        }
        case "configurationValidated": {
          const { isValid, errors = [], warnings = [] } = message.payload || {};
          console.log(
            `[QWIKI] Settings: Configuration validation result - Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`,
          );
          validating.value = false;
          lastValidationValid.value = !!isValid;
          showValidationErrors.value = !isValid;
          validationErrors.value = (errors as any[]).map((e: any) =>
            typeof e === "string" ? e : e?.message || JSON.stringify(e),
          );
          validationWarnings.value = (warnings as any[]).map((w: any) =>
            typeof w === "string" ? w : w?.message || JSON.stringify(w),
          );
          break;
        }
      }

      const messageEndTime = Date.now();
      console.log(
        `[QWIKI] Settings: Message ${message.command} processed in ${messageEndTime - messageStartTime}ms`,
      );
    } catch (error) {
      console.error(`[QWIKI] Settings: Error processing message ${message.command}:`, error);
    }
  };

  window.addEventListener("message", handleMessage);

  setTimeout(() => {
    if (centralizedProviderConfigs.value.length === 0) {
      console.error("[QWIKI] Settings: Provider configs not received within timeout");
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
          const models = getModelsForProvider(settings.selectedProvider, provider.modelFallbackIds);
          if (models.length > 0) {
            wiki.model = models[0];
          }
        }
      }
    }
  },
  { immediate: true },
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

  if (!settings.loading && !settingsLoading.value && settings.initialized) {
    navigationStatus.finish("settings");
  }
});

watch(
  () => settings.loading || settingsLoading.value,
  (loading) => {
    if (!loading && settings.initialized) {
      navigationStatus.finish("settings");
    }
  },
  { immediate: true },
);
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

        <div
          v-if="
            settings.loadingProviders || (providerConfigs.length === 0 && !wiki.providers.length)
          "
        >
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
          <div class="flex items-center justify-between">
            <h3 class="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              LLM Provider
            </h3>
            <button
              class="text-primary hover:text-primary/80 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="validating"
              :aria-busy="validating ? 'true' : 'false'"
              @click="validateCurrentConfiguration"
            >
              {{ validating ? "Validating…" : "Validate Configuration" }}
            </button>
          </div>

          <div
            v-if="lastValidationValid === true && !showValidationErrors"
            class="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-700"
          >
            <p class="text-xs font-medium">Configuration is valid.</p>
          </div>

          <div
            v-if="
              showValidationErrors && (validationErrors.length > 0 || validationWarnings.length > 0)
            "
            class="space-y-2"
          >
            <div
              v-if="validationErrors.length > 0"
              class="bg-destructive/10 border-destructive/20 text-destructive rounded-md border p-3"
            >
              <p class="text-xs font-medium">Configuration Errors:</p>
              <ul class="mt-1 space-y-1 text-xs">
                <li
                  v-for="(error, index) in validationErrors"
                  :key="index"
                  class="flex items-start gap-2"
                >
                  <svg
                    class="mt-0.5 h-3 w-3 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span>{{ error }}</span>
                </li>
              </ul>
            </div>

            <div
              v-if="validationWarnings.length > 0"
              class="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700"
            >
              <p class="text-xs font-medium">Configuration Warnings:</p>
              <ul class="mt-1 space-y-1 text-xs">
                <li
                  v-for="(warning, index) in validationWarnings"
                  :key="index"
                  class="flex items-start gap-2"
                >
                  <svg
                    class="mt-0.5 h-3 w-3 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>{{ warning }}</span>
                </li>
              </ul>
            </div>
          </div>

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

                <div
                  v-if="providerCapabilities[provider.id]"
                  class="ml-auto flex items-center gap-1"
                >
                  <div
                    v-if="getProviderCapability(provider.id, 'streaming')"
                    class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                    title="Supports Streaming"
                  >
                    Streaming
                  </div>
                  <div
                    v-if="getProviderCapability(provider.id, 'functionCalling')"
                    class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                    title="Supports Function Calling"
                  >
                    Functions
                  </div>
                  <div
                    v-if="getProviderCapability(provider.id, 'maxTokens')"
                    class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
                    :title="`Max Tokens: ${getProviderCapability(provider.id, 'maxTokens')}`"
                  >
                    {{ getProviderCapability(provider.id, "maxTokens") }} tokens
                  </div>
                </div>
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
                        @focus="handleApiKeyFocus(provider.id)"
                        @blur="handleApiKeyBlur(provider.id)"
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
                      <button
                        class="text-primary hover:text-primary/80 text-xs font-medium underline underline-offset-4"
                        @click="openExternalUrl(provider.apiKeyUrl)"
                      >
                        Get API key ->
                      </button>
                    </div>

                    <div
                      v-if="providerCapabilities[provider.id]"
                      class="border-border space-y-2 border-t pt-2"
                    >
                      <p class="text-muted-foreground text-xs font-medium">
                        Provider Capabilities:
                      </p>
                      <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="flex items-center gap-1">
                          <svg
                            class="h-3 w-3"
                            :class="
                              getProviderCapability(provider.id, 'streaming')
                                ? 'text-green-500'
                                : 'text-muted-foreground'
                            "
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>Streaming</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <svg
                            class="h-3 w-3"
                            :class="
                              getProviderCapability(provider.id, 'functionCalling')
                                ? 'text-green-500'
                                : 'text-muted-foreground'
                            "
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span>Function Calling</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-muted-foreground">Max Tokens:</span>
                          <span>{{
                            getProviderCapability(provider.id, "maxTokens") || "N/A"
                          }}</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-muted-foreground">Context:</span>
                          <span>{{
                            getProviderCapability(provider.id, "contextWindowSize") || "N/A"
                          }}</span>
                        </div>
                      </div>
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
