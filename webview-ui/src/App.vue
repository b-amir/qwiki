<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch } from "vue";
import Button from "@/components/ui/button.vue";
import DynamicSkeleton from "@/components/DynamicSkeleton.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";

const tab = ref<"wiki" | "settings">("wiki");
const wiki = useWikiStore();
const settings = useSettingsStore();
const settingsLoading = ref(false);

const handleMessage = (event: MessageEvent<{ command?: string; payload?: any }>) => {
  const command = event.data?.command;
  if (command !== "navigate") return;
  const nextTab = event.data?.payload?.tab;
  if (nextTab === "wiki" || nextTab === "settings") {
    tab.value = nextTab;
  }
};

onMounted(() => {
  window.addEventListener("message", handleMessage);
  wiki.init();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
});

const currentModels = computed(
  () => wiki.providers.find((p) => p.id === wiki.providerId)?.models || [],
);

const wikiTitle = computed(() => {
  if (wiki.content) {
    // Extract title from the first heading in the wiki content
    const headingMatch = wiki.content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
    // If no heading found, try to extract from the first line
    const firstLine = wiki.content.split("\n")[0].trim();
    if (firstLine && !firstLine.startsWith("#")) {
      return firstLine;
    }
  }
  return "Wiki";
});

const wikiContentWithoutTitle = computed(() => {
  if (wiki.content) {
    // Remove the first heading since it's displayed in the top bar
    return wiki.content.replace(/^#\s+.+$/m, "");
  }
  return wiki.content;
});

watch(
  () => wiki.providerId,
  () => {
    if (!currentModels.value.includes(wiki.model)) {
      wiki.model = currentModels.value[0] || "";
    }
  },
  { immediate: true },
);

watch(
  () => tab.value,
  async (newTab) => {
    if (newTab === "settings" && !settings.initialized) {
      settingsLoading.value = true;
      await settings.init();
      settingsLoading.value = false;
    }
  },
);

// Sync selected provider when providers are loaded
watch(
  () => wiki.providers,
  () => {
    if (wiki.providers.length > 0 && !settings.selectedProvider) {
      const withKey = wiki.providers.find((p) => p.hasKey);
      // Migrate from gemini to google-ai-studio
      settings.selectedProvider =
        withKey?.id === "gemini" ? "google-ai-studio" : withKey?.id || "google-ai-studio";
    }
  },
  { immediate: true },
);
</script>

<template>
  <main class="bg-background flex h-full w-full flex-col">
    <!-- Top bar for settings page -->
    <div
      v-if="tab === 'settings'"
      class="bg-background flex items-center justify-between border-b px-2 py-3 pl-3"
    >
      <!-- Back button on settings page -->
      <div class="flex items-center gap-2">
        <a
          class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
          title="Back"
          @click="tab = 'wiki'"
        >
          <svg class="h-5 w-5" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="currentColor" />
            <path
              d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
              fill="currentColor"
            />
          </svg>
        </a>
        <span class="text-sm font-medium">Settings</span>
      </div>
    </div>

    <!-- Top bar for wiki page when content is displayed -->
    <div
      v-if="tab === 'wiki' && (wiki.content || wiki.loading || wiki.error)"
      class="bg-background flex items-center border-b px-2 py-3 pl-3"
    >
      <!-- Back button on wiki page -->
      <div class="flex items-center gap-2">
        <a
          class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
          title="Back to homepage"
          @click="wiki.clearContent()"
        >
          <svg class="h-5 w-5" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="currentColor" />
            <path
              d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
              fill="currentColor"
            />
          </svg>
        </a>
        <span class="text-sm font-medium">{{ wikiTitle }}</span>
      </div>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-auto py-3">
      <!-- Wiki Page -->
      <div v-if="tab === 'wiki'" class="flex h-full flex-col">
        <!-- Homepage content when no wiki is generated -->
        <div v-if="!wiki.content && !wiki.loading && !wiki.error" class="flex flex-1 flex-col p-6">
          <!-- Main content area -->
          <div class="flex flex-1 flex-col items-center justify-center space-y-6">
            <!-- Qwiki Icon -->
            <div class="flex items-center justify-center">
              <svg
                width="120"
                height="120"
                viewBox="0 0 512 512"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color: #8b5cf6">
                      <animate
                        attributeName="stop-color"
                        values="#8B5CF6;#3B82F6;#8B5CF6"
                        dur="6s"
                        repeatCount="indefinite"
                      />
                    </stop>
                    <stop offset="100%" style="stop-color: #3b82f6">
                      <animate
                        attributeName="stop-color"
                        values="#3B82F6;#8B5CF6;#3B82F6"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </stop>
                  </linearGradient>
                </defs>
                <path
                  d="M361.933 444.533C332.466 459.029 296.914 467 255.496 467C117.859 467 45 378.972 45 255.997C45 133.972 117.859 45 255.496 45C393.134 45 466 133.981 466 255.997C466 291.437 459.948 323.974 448.039 352.339"
                  stroke="currentColor"
                  stroke-width="42"
                />
                <path
                  d="M326.619 306.646C366.639 336.548 406.659 366.45 446.68 396.351C448.903 398.012 451.127 399.673 453.351 401.334C450.062 417.585 420.383 445.065 407.639 448.877C405.892 446.72 404.144 444.563 402.397 442.407L308.049 325.96C306.302 323.804 304.555 321.648 302.808 319.492C306.065 312.06 311.011 307.114 319.949 301.663C322.172 303.324 324.396 304.985 326.619 306.646Z"
                  fill="currentColor"
                />
                <path
                  d="M232.684 316.76L242.897 379.486C243.603 383.819 246.295 387.573 250.173 389.632C254.158 391.747 258.917 391.818 262.963 389.824L263.177 389.719C267.44 387.618 270.404 383.562 271.11 378.862L280.192 318.44C281.07 312.592 283.082 306.971 286.112 301.893L286.364 301.471C289.511 296.197 293.747 291.654 298.789 288.146C304.504 284.17 311.094 281.634 318 280.753L380.168 272.823C385.728 272.113 390.42 268.343 392.31 263.066C393.99 258.372 393.212 253.149 390.236 249.149L389.119 247.647C386.119 243.615 381.599 240.986 376.611 240.371L320.063 233.404C311.845 232.391 304.079 229.087 297.651 223.869C293.348 220.377 289.742 216.105 287.021 211.277L286.241 209.893C283.121 204.357 281.033 198.302 280.077 192.02L271.215 133.787C270.449 128.754 267.125 124.48 262.436 122.5L262.227 122.411C258.589 120.874 254.474 120.93 250.88 122.566C246.591 124.517 243.557 128.477 242.791 133.126L233.147 191.627C232.061 198.212 230.609 204.782 227.652 210.766C226.307 213.49 224.674 216.339 222.861 218.583C222.814 218.641 222.768 218.698 222.72 218.755C213.602 229.778 198.228 232.724 184.022 234.411L134.386 240.306C129.001 240.945 124.323 244.309 122.002 249.21C120.091 253.247 119.983 257.905 121.705 262.027L121.935 262.578C124.285 268.204 129.453 272.153 135.498 272.943L195.788 280.818C202.213 281.658 208.364 283.942 213.778 287.5C219.739 291.417 224.671 296.84 228.046 303.123C230.324 307.365 231.911 312.009 232.684 316.76Z"
                  fill="url(#starGradient)"
                />
              </svg>
            </div>

            <!-- Welcome Message -->
            <h1 class="text-xl font-semibold">
              One <span class="qwiki-gradient-text">Qwiki</span> and you'll know.
            </h1>

            <!-- Tip -->
            <div class="bg-muted/20 border-border/50 rounded-lg border px-3 py-2">
              <div class="flex flex-col items-center space-y-2">
                <div class="flex flex-col items-center gap-1">
                  <p class="text-muted-foreground text-center text-xs">
                    Select code, then press:
                    <kbd
                      class="bg-background border-border/80 text-foreground inline-flex h-5 items-center justify-center rounded border px-1.5 text-xs font-medium shadow-sm"
                      >Ctrl+Shift+Q</kbd
                    >
                  </p>

                  <span class="text-muted-foreground text-xs"
                    >or right-click:<span
                      class="bg-background text-foreground shadow-xs inline-flex h-5 items-center justify-center rounded px-1.5 text-xs font-medium"
                      >Qwiki: Create a quick wiki</span
                    ></span
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom buttons area -->
          <div class="mt-auto flex flex-col gap-3 pt-6">
            <!-- Generate Wiki Button -->
            <div class="w-full">
              <Button
                :disabled="wiki.loading || !wiki.snippet?.trim()"
                class="w-full"
                @click="wiki.generate"
              >
                Generate Wiki
              </Button>
            </div>

            <!-- Change Model Link -->
            <div class="flex justify-center">
              <button
                class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
                @click="tab = 'settings'"
              >
                Change model
              </button>
            </div>
          </div>
        </div>

        <!-- Wiki content when generated -->
        <div v-else class="flex-1 overflow-auto pb-3">
          <div v-if="wiki.loading" class="h-full">
            <DynamicSkeleton
              :steps="[
                { text: 'Validating selection...', key: 'validating' },
                { text: 'Analyzing code structure...', key: 'analyzing' },
                { text: 'Finding related files...', key: 'finding' },
                { text: 'Preparing LLM request...', key: 'preparing' },
                { text: 'Generating documentation...', key: 'generating' },
                { text: 'Processing response...', key: 'processing' },
                { text: 'Finalizing documentation...', key: 'finalizing' },
              ]"
              :current-step="wiki.loadingStep"
              density="medium"
            />
          </div>
          <div v-else-if="wiki.error" class="flex h-full flex-col px-2 pl-3">
            <div class="flex flex-1 items-center justify-center">
              <div class="w-full max-w-md space-y-4">
                <!-- Error message -->
                <div class="text-center">
                  <!-- Error icon -->
                  <div class="flex justify-center">
                    <div
                      class="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full"
                    >
                      <svg
                        class="text-destructive h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                  </div>
                  <p class="text-muted-foreground text-sm">{{ wiki.error }}</p>
                </div>
              </div>
            </div>
            <!-- Change Model Link -->
            <div class="mt-auto flex justify-center pt-6">
              <button
                class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
                @click="tab = 'settings'"
              >
                Change model
              </button>
            </div>
          </div>
          <div v-else-if="wiki.content" class="px-2 pl-3">
            <MarkdownRenderer :content="wikiContentWithoutTitle" />
          </div>

          <div
            v-if="wiki.related.length || wiki.filesSample.length"
            class="border-border grid gap-4 border-t pt-4 md:grid-cols-2"
          >
            <section class="space-y-2">
              <h3 class="text-sm font-semibold tracking-wide">Related files</h3>
              <ul class="divide-border divide-y rounded border">
                <li
                  v-for="item in wiki.related"
                  :key="item.path + ':' + (item.line || 0)"
                  class="hover:bg-accent/50 cursor-pointer px-3 py-2 text-sm"
                  @click="wiki.openFile(item.path, item.line)"
                >
                  <div class="truncate font-medium">{{ item.path }}</div>
                  <div v-if="item.preview" class="text-muted-foreground truncate text-xs">
                    {{ item.preview }}
                  </div>
                </li>
              </ul>
            </section>
            <section class="space-y-2">
              <h3 class="text-sm font-semibold tracking-wide">Project</h3>
              <div v-if="wiki.overview" class="text-muted-foreground text-xs">
                {{ wiki.overview }}
              </div>
              <ul class="divide-border max-h-64 divide-y overflow-auto rounded border">
                <li
                  v-for="p in wiki.filesSample"
                  :key="p"
                  class="hover:bg-accent/50 cursor-pointer truncate px-3 py-2 text-sm"
                  @click="wiki.openFile(p)"
                >
                  {{ p }}
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>

      <!-- Settings Page -->
      <div v-else-if="tab === 'settings'" class="space-y-4">
        <div v-if="settingsLoading || settings.loading" class="h-full">
          <DynamicSkeleton
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
                  @change="wiki.providerId = 'zai'"
                />
                <label for="zai-provider" class="text-sm font-medium">Z.ai</label>
              </div>

              <div v-if="settings.selectedProvider === 'zai'" class="space-y-2 pl-6">
                <select
                  v-model="wiki.model"
                  class="bg-background w-full rounded border px-2 py-1 text-sm"
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
                />
                <a
                  href="https://z.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary text-xs underline"
                >
                  Get API key from Z.ai
                </a>
                <div class="flex gap-2">
                  <Button size="sm" :disabled="settings.saving" @click="settings.saveZai">
                    {{ settings.saving ? "Saving..." : "Save" }}
                  </Button>
                </div>
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
                  @change="wiki.providerId = 'openrouter'"
                />
                <label for="openrouter-provider" class="text-sm font-medium">OpenRouter</label>
              </div>

              <div v-if="settings.selectedProvider === 'openrouter'" class="space-y-2 pl-6">
                <select
                  v-model="wiki.model"
                  class="bg-background w-full rounded border px-2 py-1 text-sm"
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
                />
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary text-xs underline"
                >
                  Get API key from OpenRouter
                </a>
                <div class="flex gap-2">
                  <Button size="sm" :disabled="settings.saving" @click="settings.saveOpenrouter">
                    {{ settings.saving ? "Saving..." : "Save" }}
                  </Button>
                </div>
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
                  @change="wiki.providerId = 'google-ai-studio'"
                />
                <label for="google-ai-studio-provider" class="text-sm font-medium"
                  >Google AI Studio (Gemini)</label
                >
              </div>

              <div v-if="settings.selectedProvider === 'google-ai-studio'" class="space-y-2 pl-6">
                <select
                  v-model="wiki.model"
                  class="bg-background w-full rounded border px-2 py-1 text-sm"
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
                <div class="flex gap-2">
                  <Button
                    size="sm"
                    :disabled="settings.saving"
                    @click="settings.saveGoogleAIStudio"
                  >
                    {{ settings.saving ? "Saving..." : "Save" }}
                  </Button>
                </div>
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
                  @change="wiki.providerId = 'cohere'"
                />
                <label for="cohere-provider" class="text-sm font-medium">Cohere</label>
              </div>

              <div v-if="settings.selectedProvider === 'cohere'" class="space-y-2 pl-6">
                <select
                  v-model="wiki.model"
                  class="bg-background w-full rounded border px-2 py-1 text-sm"
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
                />
                <a
                  href="https://dashboard.cohere.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary text-xs underline"
                >
                  Get API key from Cohere
                </a>
                <div class="flex gap-2">
                  <Button size="sm" :disabled="settings.saving" @click="settings.saveCohere">
                    {{ settings.saving ? "Saving..." : "Save" }}
                  </Button>
                </div>
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
                  @change="wiki.providerId = 'huggingface'"
                />
                <label for="huggingface-provider" class="text-sm font-medium">Hugging Face</label>
              </div>

              <div v-if="settings.selectedProvider === 'huggingface'" class="space-y-2 pl-6">
                <select
                  v-model="wiki.model"
                  class="bg-background w-full rounded border px-2 py-1 text-sm"
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
                />
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary text-xs underline"
                >
                  Get API key from Hugging Face
                </a>
                <div class="flex gap-2">
                  <Button size="sm" :disabled="settings.saving" @click="settings.saveHuggingFace">
                    {{ settings.saving ? "Saving..." : "Save" }}
                  </Button>
                </div>
              </div>
            </div>

            <!-- Gemini Option (Hidden - Migrated to Google AI Studio) -->
            <!-- This section is commented out as Gemini is now consolidated into Google AI Studio -->
          </div>

          <div v-if="settings.savedMessage" class="text-xs text-green-600">
            {{ settings.savedMessage }}
          </div>

          <p class="text-muted-foreground text-xs">
            Keys are stored securely in VS Code Secret Storage.
          </p>
        </div>
      </div>
    </div>
  </main>
</template>

<style>
/* Minimal by design; shadcn + Tailwind handle styling. */
.qwiki-gradient-text {
  background: linear-gradient(90deg, #8b5cf6, #3b82f6);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: gradientShift 3s ease infinite;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
</style>
