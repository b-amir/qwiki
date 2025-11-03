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
    class="hover:border-primary hover:bg-muted/90 focus-within:border-primary group overflow-clip rounded-xl border border-transparent"
    :class="{
      'bg-foreground border-transparent shadow-sm focus-within:border-transparent': isSelected,
      'bg-muted': !isSelected,
    }"
    :style="{
      transition: 'background-color 0.08s ease-out, border-color 0.08s ease-out',
      willChange: 'background-color, border-color',
    }"
  >
    <div
      class="provider-header flex cursor-pointer select-none items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3"
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
        <div
          class="provider-radio flex items-center justify-center rounded-full border-2"
          :class="
            isSelected
              ? 'border-primary bg-primary ring-primary/20 ring-2'
              : 'border-muted-foreground group-hover:border-primary'
          "
        >
          <div v-if="isSelected" class="bg-background rounded-full" />
        </div>
      </div>
      <label
        :for="`${provider.id}-provider`"
        class="provider-name min-w-0 flex-1 cursor-pointer font-medium"
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
        class="provider-content border-border bg-background border-t text-sm"
        :style="{
          opacity: isSelected ? 1 : 0,
          transition: 'opacity 0.15s ease-out 0.05s',
          transform: isSelected ? 'translateY(0)' : 'translateY(-8px)',
          willChange: 'opacity, transform',
        }"
        @vue:mounted="emit('calculate-height', provider.id)"
      >
        <div class="provider-content-inner space-y-3 sm:space-y-4">
          <div class="provider-field space-y-1.5 sm:space-y-2">
            <label class="provider-label text-muted-foreground text-xs font-medium tracking-wide">
              Model
            </label>
            <select
              v-model="wiki.model"
              class="provider-input border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full appearance-none rounded-lg border px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2"
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

          <div class="provider-field space-y-1.5 sm:space-y-2">
            <label class="provider-label text-muted-foreground text-xs font-medium tracking-wide">
              API Key
            </label>
            <input
              :value="getApiKeyInput(provider.id)"
              type="password"
              placeholder="Enter your API key"
              class="provider-input border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full rounded-lg border px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2"
              @focus="emit('api-key-focus', provider.id)"
              @blur="emit('api-key-blur', provider.id)"
              @input="
                emit('api-key-change', provider.id, ($event.target as HTMLInputElement).value)
              "
            />
          </div>

          <div
            v-for="field in provider.customFields"
            :key="field.id"
            class="provider-field space-y-1.5 sm:space-y-2"
          >
            <label class="provider-label text-muted-foreground text-xs font-medium tracking-wide">
              {{ field.label }}
            </label>
            <input
              v-if="field.type === 'text'"
              :value="getCustomFieldValue(field.id)"
              type="text"
              :placeholder="field.placeholder"
              class="provider-input border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full rounded-lg border px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2"
              @input="
                emit('custom-field-change', field.id, ($event.target as HTMLInputElement).value)
              "
            />
            <select
              v-else-if="field.type === 'select'"
              :value="getCustomFieldValue(field.id)"
              class="provider-input border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full appearance-none rounded-lg border px-2.5 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2"
              @change="
                emit('custom-field-change', field.id, ($event.target as HTMLSelectElement).value)
              "
            >
              <option v-for="option in field.options" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>

          <div class="provider-link pt-1">
            <button
              class="text-primary hover:text-primary/80 text-xs font-medium underline underline-offset-2 sm:underline-offset-4"
              @click="emit('open-url', provider.apiKeyUrl)"
            >
              Get API key ->
            </button>
          </div>

          <div
            v-if="providerCapabilities"
            class="provider-capabilities border-border space-y-1.5 border-t pt-2 sm:space-y-2"
          >
            <p class="text-muted-foreground text-xs font-medium">Provider Capabilities:</p>
            <div
              class="provider-capabilities-grid grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2 md:grid-cols-4"
            >
              <div class="flex items-center gap-1">
                <svg
                  class="h-3 w-3"
                  :class="
                    getProviderCapability('streaming') ? 'text-green-500' : 'text-muted-foreground'
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
                    getProviderCapability('functionCalling')
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
                <span>
                  {{
                    getProviderCapability("maxTokens")
                      ? typeof getProviderCapability("maxTokens") === "number"
                        ? getProviderCapability("maxTokens").toLocaleString()
                        : getProviderCapability("maxTokens")
                      : "N/A"
                  }}
                </span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-muted-foreground">Context:</span>
                <span>
                  {{
                    getProviderCapability("contextWindowSize")
                      ? typeof getProviderCapability("contextWindowSize") === "number"
                        ? getProviderCapability("contextWindowSize").toLocaleString()
                        : getProviderCapability("contextWindowSize")
                      : "N/A"
                  }}
                </span>
              </div>
            </div>
          </div>

          <p
            v-if="provider.additionalInfo"
            class="provider-additional-info text-muted-foreground text-xs leading-relaxed"
          >
            {{ provider.additionalInfo }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.provider-header {
  min-width: 0;
}

.provider-radio {
  width: clamp(14px, 3.5vw, 16px);
  height: clamp(14px, 3.5vw, 16px);
  flex-shrink: 0;
}

.provider-radio > div {
  width: clamp(6px, 1.5vw, 8px);
  height: clamp(6px, 1.5vw, 8px);
}

.provider-name {
  font-size: clamp(0.8125rem, 2.5vw, 0.875rem);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-content {
  padding-left: clamp(0.75rem, 2vw, 1rem);
  padding-right: clamp(0.75rem, 2vw, 1rem);
  padding-top: clamp(0.625rem, 1.5vw, 0.75rem);
  padding-bottom: clamp(1rem, 3vw, 1.25rem);
}

.provider-content-inner {
  min-width: 0;
}

.provider-field {
  min-width: 0;
}

.provider-label {
  font-size: clamp(0.6875rem, 2vw, 0.75rem);
  line-height: 1.4;
  display: block;
}

.provider-input {
  font-size: clamp(0.8125rem, 2.5vw, 0.875rem);
  line-height: 1.5;
  min-width: 0;
}

.provider-link {
  padding-top: clamp(0.25rem, 0.5vw, 0.5rem);
}

.provider-capabilities {
  min-width: 0;
  padding-top: clamp(0.5rem, 1vw, 0.75rem);
}

.provider-capabilities p {
  font-size: clamp(0.6875rem, 2vw, 0.75rem);
  line-height: 1.4;
}

.provider-capabilities-grid {
  font-size: clamp(0.6875rem, 2vw, 0.75rem);
  line-height: 1.5;
}

.provider-capabilities-grid svg {
  width: clamp(12px, 3vw, 14px);
  height: clamp(12px, 3vw, 14px);
  flex-shrink: 0;
}

.provider-additional-info {
  font-size: clamp(0.6875rem, 2vw, 0.75rem);
  line-height: 1.6;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
