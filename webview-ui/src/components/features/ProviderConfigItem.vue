<script setup lang="ts">
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";

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
}>();

const wiki = useWikiStore();
const settings = useSettingsStore();

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

const getProviderCapability = (capability: string) => {
  return props.providerCapabilities?.[props.provider.id]?.[capability] || false;
};

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
      class="flex cursor-pointer select-none items-center gap-3 px-4 py-3"
      @click="emit('provider-change', provider.id)"
    >
      <div class="relative flex items-center">
        <input
          :id="`${provider.id}-provider`"
          v-model="settings.selectedProvider"
          type="radio"
          :value="provider.id"
          class="sr-only"
          @change="emit('provider-change', provider.id)"
        />
        <div
          class="flex h-4 w-4 items-center justify-center rounded-full border-2"
          :class="
            isSelected
              ? 'border-primary bg-primary ring-primary/20 ring-2'
              : 'border-muted-foreground group-hover:border-primary'
          "
        >
          <div v-if="isSelected" class="bg-background h-2 w-2 rounded-full" />
        </div>
      </div>
      <label
        :for="`${provider.id}-provider`"
        class="cursor-pointer text-sm font-medium"
        :class="isSelected ? 'text-background' : 'text-foreground'"
      >
        {{ provider.name }}
      </label>

      <div v-if="providerCapabilities" class="ml-auto flex items-center gap-1">
        <div
          v-if="getProviderCapability('streaming')"
          class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
          title="Supports Streaming"
        >
          Streaming
        </div>
        <div
          v-if="getProviderCapability('functionCalling')"
          class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
          title="Supports Function Calling"
        >
          Functions
        </div>
        <div
          v-if="getProviderCapability('maxTokens')"
          class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
          :title="`Max Tokens: ${getProviderCapability('maxTokens')}`"
        >
          {{ getProviderCapability("maxTokens") }} tokens
        </div>
      </div>
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
        class="border-border bg-background border-t px-4 pb-5 pt-3 text-sm"
        :style="{
          opacity: isSelected ? 1 : 0,
          transition: 'opacity 0.15s ease-out 0.05s',
          transform: isSelected ? 'translateY(0)' : 'translateY(-8px)',
          willChange: 'opacity, transform',
        }"
        @vue:mounted="emit('calculate-height', provider.id)"
      >
        <div class="space-y-4">
          <div class="space-y-2">
            <label class="text-muted-foreground text-xs font-medium tracking-wide"> Model </label>
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
            <label class="text-muted-foreground text-xs font-medium tracking-wide"> API Key </label>
            <input
              :value="getApiKeyInput(provider.id)"
              type="password"
              placeholder="Enter your API key"
              class="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              @focus="emit('api-key-focus', provider.id)"
              @blur="emit('api-key-blur', provider.id)"
              @input="
                emit('api-key-change', provider.id, ($event.target as HTMLInputElement).value)
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
                emit('custom-field-change', field.id, ($event.target as HTMLInputElement).value)
              "
            />
            <select
              v-else-if="field.type === 'select'"
              :value="getCustomFieldValue(field.id)"
              class="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground w-full appearance-none rounded-lg border px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              @change="
                emit('custom-field-change', field.id, ($event.target as HTMLSelectElement).value)
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
              @click="emit('open-url', provider.apiKeyUrl)"
            >
              Get API key ->
            </button>
          </div>

          <div v-if="providerCapabilities" class="border-border space-y-2 border-t pt-2">
            <p class="text-muted-foreground text-xs font-medium">Provider Capabilities:</p>
            <div class="grid grid-cols-2 gap-2 text-xs">
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
                <span>{{ getProviderCapability("maxTokens") || "N/A" }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-muted-foreground">Context:</span>
                <span>{{ getProviderCapability("contextWindowSize") || "N/A" }}</span>
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
</template>
