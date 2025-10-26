<script setup lang="ts">
import { ref, computed, watch } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";

const wiki = useWikiStore();
const settings = useSettingsStore();
const settingsLoading = ref(false);

const currentModels = computed(
  () => wiki.providers.find((p) => p.id === wiki.providerId)?.models || [],
);

// Handle provider selection change
const handleProviderChange = (providerId: string) => {
  wiki.providerId = providerId;
  settings.autoSaveProviderSelection(providerId);
};

// Handle API key change with auto-save
const handleApiKeyChange = (providerId: string, newValue: string) => {
  settings.trackApiKeyChange(providerId, newValue);
  settings.autoSaveApiKey(providerId, newValue);
};

// Initialize settings when component is mounted
const initSettings = async () => {
  if (!settings.initialized) {
    settingsLoading.value = true;
    await settings.init();
    settingsLoading.value = false;
  }
};

// Initialize on component mount
initSettings();
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
      <!-- Provider Selection with Radio Buttons -->
      <div class="space-y-4">
        <h3 class="text-sm font-medium">LLM Provider</h3>

        <!-- Z.ai Option -->
        <div class="space-y-3 rounded-md border p-3">
          <div class="flex items-center space-x-2">
            <input
              id="zai-provider"
              v-model="settings.selectedProvider"
              type="radio"
              value="zai"
              class="h-4 w-4"
              @change="handleProviderChange('zai')"
            />
            <label for="zai-provider" class="text-sm font-medium">Z.ai</label>
          </div>

          <div v-if="settings.selectedProvider === 'zai'" class="space-y-2 pl-6">
            <select
              v-model="wiki.model"
              class="bg-background w-full rounded border px-2 py-1 text-sm hover:[filter:brightness(1.1)]"
            >
              <option
                v-for="m in wiki.providers.find((p) => p.id === 'zai')?.models || []"
                :key="m"
                :value="m"
              >
                {{ m }}
              </option>
            </select>
            <input
              v-model="settings.zaiKeyInput"
              type="password"
              placeholder="API Key"
              class="bg-background w-full rounded border px-2 py-1 text-sm"
              @input="handleApiKeyChange('zai', ($event.target as HTMLInputElement).value)"
            />
            <a
              href="https://z.ai"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary text-xs underline"
            >
              Get API key from Z.ai
            </a>
            <p class="text-muted-foreground text-xs">
              Optional: configure base URL in VS Code settings at qwiki.zaiBaseUrl
            </p>
          </div>
        </div>

        <!-- OpenRouter Option -->
        <div class="space-y-3 rounded-md border p-3">
          <div class="flex items-center space-x-2">
            <input
              id="openrouter-provider"
              v-model="settings.selectedProvider"
              type="radio"
              value="openrouter"
              class="h-4 w-4"
              @change="handleProviderChange('openrouter')"
            />
            <label for="openrouter-provider" class="text-sm font-medium">OpenRouter</label>
          </div>

          <div v-if="settings.selectedProvider === 'openrouter'" class="space-y-2 pl-6">
            <select
              v-model="wiki.model"
              class="bg-background w-full rounded border px-2 py-1 text-sm hover:[filter:brightness(1.1)]"
            >
              <option
                v-for="m in wiki.providers.find((p) => p.id === 'openrouter')?.models || []"
                :key="m"
                :value="m"
              >
                {{ m }}
              </option>
            </select>
            <input
              v-model="settings.openrouterKeyInput"
              type="password"
              placeholder="API Key"
              class="bg-background w-full rounded border px-2 py-1 text-sm"
              @input="handleApiKeyChange('openrouter', ($event.target as HTMLInputElement).value)"
            />
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary text-xs underline"
            >
              Get API key from OpenRouter
            </a>
          </div>
        </div>

        <!-- Google AI Studio Option (Consolidated Gemini + Google AI Studio) -->
        <div class="space-y-3 rounded-md border p-3">
          <div class="flex items-center space-x-2">
            <input
              id="google-ai-studio-provider"
              v-model="settings.selectedProvider"
              type="radio"
              value="google-ai-studio"
              class="h-4 w-4"
              @change="handleProviderChange('google-ai-studio')"
            />
            <label for="google-ai-studio-provider" class="text-sm font-medium"
              >Google AI Studio (Gemini)</label
            >
          </div>

          <div v-if="settings.selectedProvider === 'google-ai-studio'" class="space-y-2 pl-6">
            <select
              v-model="wiki.model"
              class="bg-background w-full rounded border px-2 py-1 text-sm hover:[filter:brightness(1.1)]"
            >
              <option
                v-for="m in wiki.providers.find((p) => p.id === 'google-ai-studio')?.models ||
                wiki.providers.find((p) => p.id === 'gemini')?.models ||
                []"
                :key="m"
                :value="m"
              >
                {{ m }}
              </option>
            </select>
            <input
              v-model="settings.googleAIStudioKeyInput"
              type="password"
              placeholder="API Key"
              class="bg-background w-full rounded border px-2 py-1 text-sm"
              @input="
                handleApiKeyChange('google-ai-studio', ($event.target as HTMLInputElement).value)
              "
            />
            <div class="space-y-1">
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
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary text-xs underline"
            >
              Get API key from Google AI Studio
            </a>
          </div>
        </div>

        <!-- Cohere Option -->
        <div class="space-y-3 rounded-md border p-3">
          <div class="flex items-center space-x-2">
            <input
              id="cohere-provider"
              v-model="settings.selectedProvider"
              type="radio"
              value="cohere"
              class="h-4 w-4"
              @change="handleProviderChange('cohere')"
            />
            <label for="cohere-provider" class="text-sm font-medium">Cohere</label>
          </div>

          <div v-if="settings.selectedProvider === 'cohere'" class="space-y-2 pl-6">
            <select
              v-model="wiki.model"
              class="bg-background w-full rounded border px-2 py-1 text-sm hover:[filter:brightness(1.1)]"
            >
              <option
                v-for="m in wiki.providers.find((p) => p.id === 'cohere')?.models || []"
                :key="m"
                :value="m"
              >
                {{ m }}
              </option>
            </select>
            <input
              v-model="settings.cohereKeyInput"
              type="password"
              placeholder="API Key"
              class="bg-background w-full rounded border px-2 py-1 text-sm"
              @input="handleApiKeyChange('cohere', ($event.target as HTMLInputElement).value)"
            />
            <a
              href="https://dashboard.cohere.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary text-xs underline"
            >
              Get API key from Cohere
            </a>
          </div>
        </div>

        <!-- Hugging Face Option -->
        <div class="space-y-3 rounded-md border p-3">
          <div class="flex items-center space-x-2">
            <input
              id="huggingface-provider"
              v-model="settings.selectedProvider"
              type="radio"
              value="huggingface"
              class="h-4 w-4"
              @change="handleProviderChange('huggingface')"
            />
            <label for="huggingface-provider" class="text-sm font-medium">Hugging Face</label>
          </div>

          <div v-if="settings.selectedProvider === 'huggingface'" class="space-y-2 pl-6">
            <select
              v-model="wiki.model"
              class="bg-background w-full rounded border px-2 py-1 text-sm hover:[filter:brightness(1.1)]"
            >
              <option
                v-for="m in wiki.providers.find((p) => p.id === 'huggingface')?.models || []"
                :key="m"
                :value="m"
              >
                {{ m }}
              </option>
            </select>
            <input
              v-model="settings.huggingfaceKeyInput"
              type="password"
              placeholder="API Key"
              class="bg-background w-full rounded border px-2 py-1 text-sm"
              @input="handleApiKeyChange('huggingface', ($event.target as HTMLInputElement).value)"
            />
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary text-xs underline"
            >
              Get API key from Hugging Face
            </a>
          </div>
        </div>

        <!-- Gemini Option (Hidden - Migrated to Google AI Studio) -->
        <!-- This section is commented out as Gemini is now consolidated into Google AI Studio -->
      </div>

      <p class="text-muted-foreground text-xs">
        Keys are stored securely in VS Code Secret Storage.
      </p>
    </div>
  </div>
</template>
