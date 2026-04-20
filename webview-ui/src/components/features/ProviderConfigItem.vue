<script setup lang="ts">
import { watch } from "vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { vscode } from "@/utilities/vscode";

interface ProviderConfig {
  id: string;
  name: string;
  apiKeyUrl: string;
  modelFallbackIds?: string[];
  defaultModel?: string;
  customFields?: Array<{
    id: string;
    label: string;
    type: "text" | "select";
    placeholder?: string;
    options?: string[];
  }>;
  additionalInfo?: string;
  models?: string[];
}

// Provider-specific API key patterns
const PROVIDER_KEY_PATTERNS: Record<string, string> = {
  cohere: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "google-ai-studio": "AIza...",
  huggingface: "hf_...",
  openrouter: "sk-or-...",
  zai: "your-api-key-here",
  custom: "your-api-key-here",
};

interface Props {
  provider: ProviderConfig;
  isSelected: boolean;
  contentHeight?: number;
  providerCapabilities?: Record<string, any>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "provider-change": [providerId: string];
  "api-key-change": [providerId: string, value: string];
  "api-key-focus": [providerId: string];
  "api-key-blur": [providerId: string];
  "custom-field-change": [fieldId: string, value: string];
  "open-url": [url: string];
  "calculate-height": [providerId: string];
  "model-change": [providerId: string, model: string];
}>();

const wiki = useWikiStore();
const settings = useSettingsStore();

// Get provider-specific API key placeholder
const getApiKeyPlaceholder = () => {
  return PROVIDER_KEY_PATTERNS[props.provider.id] || "your-api-key-here";
};

const getModelsForProvider = (providerId: string, fallbackIds?: string[]) => {
  if (props.provider?.models?.length) {
    return props.provider.models;
  }

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

const getProviderCapability = (capability: string) => {
  return props.providerCapabilities?.[props.provider.id]?.[capability] ?? null;
};

watch(
  () => wiki.model,
  (newModel, oldModel) => {
    if (
      props.isSelected &&
      props.provider.id === settings.selectedProvider &&
      newModel &&
      newModel !== oldModel
    ) {
      vscode.postMessage({
        command: "getProviderCapabilities",
        payload: {
          providerId: props.provider.id,
          model: newModel,
        },
      });
      emit("model-change", props.provider.id, newModel);
    }
  },
);

watch(
  () => settings.selectedProvider,
  (newProviderId) => {
    if (newProviderId === props.provider.id && wiki.model) {
      vscode.postMessage({
        command: "getProviderCapabilities",
        payload: {
          providerId: props.provider.id,
          model: wiki.model,
        },
      });
    }
  },
);

const getCustomFieldValue = (fieldId: string) => {
  return settings.customSettings[fieldId] || "";
};
</script>

<template>
  <div
    class="border-border/60 bg-background/50 hover:border-primary/50 hover:bg-muted/30 group overflow-clip rounded-lg border transition-all duration-200 ease-out"
    :class="{
      'border-primary shadow-primary/5 shadow-sm': isSelected,
    }"
  >
    <div
      class="flex min-w-0 cursor-pointer select-none items-center gap-2 px-3 py-2 transition-colors duration-200"
      :class="{
        'bg-primary': isSelected,
      }"
      @click="emit('provider-change', provider.id)"
    >
      <div class="relative flex flex-shrink-0 items-center">
        <input
          :id="`${provider.id}-provider`"
          v-model="settings.selectedProvider"
          type="radio"
          :value="provider.id"
          class="sr-only"
          @change="emit('provider-change', provider.id)"
        />
        <div class="relative flex h-4 w-4 flex-shrink-0 items-center justify-center">
          <div
            class="absolute inset-0 rounded-full border-2 transition-all duration-200"
            :class="
              isSelected
                ? 'border-background'
                : 'border-muted-foreground/40 group-hover:border-primary/60'
            "
          />
          <div
            v-if="isSelected"
            class="bg-background h-2 w-2 scale-100 rounded-full transition-transform duration-200"
          />
        </div>
      </div>
      <label
        :for="`${provider.id}-provider`"
        class="min-w-0 flex-1 cursor-pointer truncate text-xs font-medium tracking-tight"
        :class="isSelected ? 'text-background' : 'text-foreground'"
      >
        {{ provider.name }}
      </label>
    </div>
    <div
      class="overflow-hidden"
      :style="{
        height: isSelected ? `${contentHeight || 0}px` : '0px',
        transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'height',
      }"
    >
      <div
        v-show="isSelected"
        :id="`provider-content-${provider.id}`"
        class="border-border/40 bg-background/80 min-w-0 border-t px-3 py-3 text-xs transition-all duration-200 ease-out"
        :style="{
          opacity: isSelected ? 1 : 0,
          transform: isSelected ? 'translateY(0)' : 'translateY(-8px)',
        }"
        @vue:mounted="emit('calculate-height', provider.id)"
      >
        <div class="min-w-0 space-y-3">
          <!-- Model Select - Only show if models are available -->
          <div
            v-if="getModelsForProvider(provider.id, provider.modelFallbackIds).length > 0"
            class="w-full space-y-1.5"
          >
            <label class="text-muted-foreground block text-[10px] font-medium tracking-wide"
              >Model</label
            >
            <select
              v-model="wiki.model"
              class="border-input bg-background placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/10 w-full rounded-md border px-2.5 py-2 text-xs shadow-sm transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
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

          <!-- API Key Input -->
          <div class="w-full space-y-1.5">
            <label class="text-muted-foreground block text-[10px] font-medium tracking-wide"
              >API Key</label
            >
            <div class="relative w-full">
              <input
                :value="getApiKeyInput(provider.id)"
                type="password"
                :placeholder="getApiKeyPlaceholder()"
                :class="[
                  'border-input bg-background placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/10 w-full rounded-md border px-2.5 py-2 pr-7 text-xs shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
                  settings.providerValidationErrors[provider.id]?.some(
                    (e) => e.field === 'apiKey' && e.severity === 'error',
                  )
                    ? 'border-destructive focus:border-destructive focus:ring-destructive/10'
                    : '',
                ]"
                @focus="emit('api-key-focus', provider.id)"
                @blur="emit('api-key-blur', provider.id)"
                @input="
                  emit('api-key-change', provider.id, ($event.target as HTMLInputElement).value)
                "
              />
              <div
                v-if="settings.savingStates[provider.id]"
                class="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <svg
                  v-if="settings.savingStates[provider.id] === 'saving'"
                  class="text-primary h-3 w-3 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <svg
                  v-else-if="settings.savingStates[provider.id] === 'saved'"
                  class="h-3 w-3 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
                <svg
                  v-else-if="settings.savingStates[provider.id] === 'error'"
                  class="text-destructive h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <p
              v-if="
                settings.providerValidationErrors[provider.id]?.some(
                  (e) => e.field === 'apiKey' && e.severity === 'error',
                )
              "
              class="text-destructive mt-1 text-[10px] leading-tight"
            >
              {{
                settings.providerValidationErrors[provider.id].find(
                  (e) => e.field === "apiKey" && e.severity === "error",
                )?.message || "Invalid API key"
              }}
            </p>
          </div>

          <!-- Custom Fields -->
          <div v-for="field in provider.customFields" :key="field.id" class="w-full space-y-1.5">
            <label class="text-muted-foreground block text-[10px] font-medium tracking-wide">
              {{ field.label }}
            </label>
            <input
              v-if="field.type === 'text'"
              :value="getCustomFieldValue(field.id)"
              type="text"
              :placeholder="field.placeholder"
              class="border-input bg-background placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/10 w-full rounded-md border px-2.5 py-2 text-xs shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              @input="
                emit('custom-field-change', field.id, ($event.target as HTMLInputElement).value)
              "
            />
            <select
              v-else-if="field.type === 'select'"
              :value="getCustomFieldValue(field.id)"
              class="border-input bg-background placeholder:text-muted-foreground focus:border-foreground focus:ring-foreground/10 w-full rounded-md border px-2.5 py-2 text-xs shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              @change="
                emit('custom-field-change', field.id, ($event.target as HTMLSelectElement).value)
              "
            >
              <option v-for="option in field.options" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>

          <!-- Divider - Only show if there's an API key URL -->
          <div v-if="provider.apiKeyUrl" class="bg-border/40 h-px" />

          <!-- Action Row: Get API Key + Capabilities -->
          <div
            v-if="
              provider.apiKeyUrl ||
              (providerCapabilities &&
                (getProviderCapability('streaming') !== undefined ||
                  getProviderCapability('functionCalling') !== undefined ||
                  getProviderCapability('maxTokens') !== undefined))
            "
            class="flex items-center justify-between gap-2"
          >
            <button
              v-if="provider.apiKeyUrl"
              class="text-primary hover:text-primary/70 active:text-primary/50 text-[10px] font-medium underline underline-offset-2 transition-all duration-150"
              @click="emit('open-url', provider.apiKeyUrl)"
            >
              Get API key →
            </button>

            <!-- Compact Capabilities - Only show if available -->
            <div
              v-if="
                providerCapabilities &&
                (getProviderCapability('streaming') !== undefined ||
                  getProviderCapability('functionCalling') !== undefined ||
                  getProviderCapability('maxTokens') !== undefined)
              "
              class="flex items-center gap-2.5 text-[10px]"
            >
              <span
                v-if="getProviderCapability('streaming') !== undefined"
                class="flex items-center gap-1"
                :class="
                  getProviderCapability('streaming')
                    ? 'text-emerald-400'
                    : 'text-muted-foreground/50'
                "
              >
                <svg
                  class="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path v-if="getProviderCapability('streaming')" d="M5 13l4 4L19 7" />
                  <path v-else d="M6 18L18 6M6 6l12 12" />
                </svg>
                Stream
              </span>
              <span
                v-if="getProviderCapability('functionCalling') !== undefined"
                class="flex items-center gap-1"
                :class="
                  getProviderCapability('functionCalling')
                    ? 'text-emerald-400'
                    : 'text-muted-foreground/50'
                "
              >
                <svg
                  class="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path v-if="getProviderCapability('functionCalling')" d="M5 13l4 4L19 7" />
                  <path v-else d="M6 18L18 6M6 6l12 12" />
                </svg>
                Functions
              </span>
              <span
                v-if="getProviderCapability('maxTokens') !== undefined"
                class="text-muted-foreground/70 flex items-center gap-1"
              >
                <svg
                  class="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
                {{
                  typeof getProviderCapability("maxTokens") === "number"
                    ? (getProviderCapability("maxTokens") / 1000).toFixed(0) + "k"
                    : getProviderCapability("maxTokens")
                }}
              </span>
            </div>
          </div>

          <p
            v-if="provider.additionalInfo"
            class="text-muted-foreground mt-0 break-words text-[10px] leading-snug"
          >
            {{ provider.additionalInfo }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
