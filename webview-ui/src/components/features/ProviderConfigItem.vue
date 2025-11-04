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
      class="flex min-w-0 cursor-pointer select-none items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:gap-4 md:px-5 md:py-3.5"
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
          class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border-2 sm:h-4 sm:w-4"
          :class="
            isSelected
              ? 'border-primary bg-primary ring-primary/20 ring-2'
              : 'border-muted-foreground group-hover:border-primary'
          "
        >
          <div v-if="isSelected" class="bg-background h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2" />
        </div>
      </div>
      <label
        :for="`${provider.id}-provider`"
        class="min-w-0 flex-1 cursor-pointer truncate text-sm font-medium leading-snug sm:text-sm md:text-base"
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
        class="border-border bg-background min-w-0 border-t px-3 py-2.5 text-sm transition-[opacity,transform] delay-75 duration-150 ease-out will-change-[opacity,transform] sm:px-4 sm:py-3 md:px-5 md:py-4"
        :style="{
          opacity: isSelected ? 1 : 0,
          transform: isSelected ? 'translateY(0)' : 'translateY(-8px)',
        }"
        @vue:mounted="emit('calculate-height', provider.id)"
      >
        <div class="min-w-0 space-y-3 sm:space-y-4 md:space-y-5">
          <div class="min-w-0 space-y-1.5 sm:space-y-2 md:space-y-2.5">
            <label
              class="text-muted-foreground block text-xs font-medium leading-snug tracking-wide sm:text-xs"
            >
              Model
            </label>
            <select
              v-model="wiki.model"
              class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-w-0 rounded-lg border px-2.5 py-2 text-sm leading-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2.5 md:px-3.5 md:py-3"
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

          <div class="min-w-0 space-y-1.5 sm:space-y-2 md:space-y-2.5">
            <label
              class="text-muted-foreground block text-xs font-medium leading-snug tracking-wide sm:text-xs"
            >
              API Key
            </label>
            <input
              :value="getApiKeyInput(provider.id)"
              type="password"
              placeholder="Enter your API key"
              class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-w-0 rounded-lg border px-2.5 py-2 text-sm leading-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2.5 md:px-3.5 md:py-3"
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
            class="min-w-0 space-y-1.5 sm:space-y-2 md:space-y-2.5"
          >
            <label
              class="text-muted-foreground block text-xs font-medium leading-snug tracking-wide sm:text-xs"
            >
              {{ field.label }}
            </label>
            <input
              v-if="field.type === 'text'"
              :value="getCustomFieldValue(field.id)"
              type="text"
              :placeholder="field.placeholder"
              class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-w-0 rounded-lg border px-2.5 py-2 text-sm leading-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2.5 md:px-3.5 md:py-3"
              @input="
                emit('custom-field-change', field.id, ($event.target as HTMLInputElement).value)
              "
            />
            <select
              v-else-if="field.type === 'select'"
              :value="getCustomFieldValue(field.id)"
              class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-w-0 rounded-lg border px-2.5 py-2 text-sm leading-normal shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2.5 md:px-3.5 md:py-3"
              @change="
                emit('custom-field-change', field.id, ($event.target as HTMLSelectElement).value)
              "
            >
              <option v-for="option in field.options" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>

          <div class="pt-1 sm:pt-1.5 md:pt-2">
            <button
              class="text-primary hover:text-primary/80 text-xs font-medium underline underline-offset-2 transition-colors sm:text-xs sm:underline-offset-4 md:text-sm"
              @click="emit('open-url', provider.apiKeyUrl)"
            >
              Get API key ->
            </button>
          </div>

          <div
            v-if="providerCapabilities"
            class="border-border min-w-0 space-y-1.5 border-t pt-2 sm:space-y-2 md:space-y-2.5 md:pt-3"
          >
            <p class="text-muted-foreground text-xs font-medium leading-snug sm:text-xs md:text-sm">
              Provider Capabilities:
            </p>
            <div
              class="grid grid-cols-1 gap-x-3 gap-y-1.5 text-xs leading-normal sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2 sm:text-xs md:grid-cols-2 md:gap-x-6 md:gap-y-2.5 lg:grid-cols-4"
            >
              <div class="flex items-center gap-1.5 sm:gap-2">
                <svg
                  class="h-3 w-3 flex-shrink-0 sm:h-[14px] sm:w-[14px]"
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
                <span class="break-words">Streaming</span>
              </div>
              <div class="flex items-center gap-1.5 sm:gap-2">
                <svg
                  class="h-3 w-3 flex-shrink-0 sm:h-[14px] sm:w-[14px]"
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
                <span class="break-words">Function Calling</span>
              </div>
              <div class="flex items-center gap-1.5 sm:gap-2">
                <span class="text-muted-foreground whitespace-nowrap">Max Tokens:</span>
                <span class="break-all">
                  {{
                    getProviderCapability("maxTokens")
                      ? typeof getProviderCapability("maxTokens") === "number"
                        ? getProviderCapability("maxTokens").toLocaleString()
                        : getProviderCapability("maxTokens")
                      : "N/A"
                  }}
                </span>
              </div>
              <div class="flex items-center gap-1.5 sm:gap-2">
                <span class="text-muted-foreground whitespace-nowrap">Context:</span>
                <span class="break-all">
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
            class="text-muted-foreground break-words text-xs leading-relaxed"
          >
            {{ provider.additionalInfo }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
