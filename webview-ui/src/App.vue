<script setup lang="ts">
import { computed, watch } from "vue";
import { TopBar } from "@/components/layout";
import {
  HomePage,
  SettingsPage,
  ErrorHistoryPage,
  SavedWikisPage,
  WikiPage,
} from "@/components/pages";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { useEnvironmentStore } from "@/stores/environment";
import { useNavigation } from "@/composables/useNavigation";
import { usePageLoading } from "@/composables/usePageLoading";
import { useBatchMessageBridge } from "@/composables/useBatchMessageBridge";
import LoadingState from "@/components/features/LoadingState.vue";
import GlobalErrorModal from "@/components/features/GlobalErrorModal.vue";
import { createLogger, FrontendLoggingService, type LogMode } from "@/utilities/logging";
import { vscode } from "@/utilities/vscode";

const logger = createLogger("App");
const { currentPage } = useNavigation();
const wiki = useWikiStore();
const settings = useSettingsStore();
const environment = useEnvironmentStore();

vscode.postMessage({ command: "webviewReady" });
vscode.postMessage({ command: "getProviders" });

const handleMessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.command === "setLoggingMode") {
    const mode = message.payload?.mode as LogMode;
    if (mode && ["none", "minimal", "development"].includes(mode)) {
      const frontendLoggingService = FrontendLoggingService.getInstance();
      frontendLoggingService.setMode(mode);
    }
  }
};

window.addEventListener("message", handleMessage);

wiki.init();
settings.init();
environment.init();
useBatchMessageBridge();

watch(
  () => currentPage.value,
  (newPage, oldPage) => {
    logger.info("currentPage changed", { from: oldPage, to: newPage });
    try {
      vscode.postMessage({
        command: "frontendLog",
        payload: {
          message: "App: currentPage changed",
          data: { from: oldPage, to: newPage },
        },
      });
    } catch {}
  },
  { immediate: true },
);

watch(
  () => ({
    currentPage: currentPage.value,
    wikiContent: !!wiki.content,
    wikiLoading: wiki.loading,
    wikiNavigationLoading: wikiPageLoading.showNavigationLoading.value,
    showWikiLoading: showWikiLoading.value,
  }),
  (state) => {
    logger.info("App render state", state);
  },
  { immediate: true },
);

// Use page loading composables for each page
const wikiPageLoading = usePageLoading("wiki", "wiki");
const settingsPageLoading = usePageLoading("settings", "settings");
const errorHistoryPageLoading = usePageLoading("errorHistory", "errorHistory");

// Wiki page also shows loading when wiki store is loading
const showWikiLoading = computed(() => {
  return wikiPageLoading.showPageLoading.value || wiki.loading;
});

const currentModels = computed(
  () => wiki.providers.find((p) => p.id === wiki.providerId)?.models || [],
);

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
  () => wiki.providers,
  () => {
    if (wiki.providers.length > 0) {
      if (!settings.selectedProvider) {
        const withKey = wiki.providers.find((p) => p.hasKey);
        settings.selectedProvider = withKey?.id || wiki.providers[0]?.id || "google-ai-studio";
      }

      if (!wiki.providerId) {
        wiki.providerId = settings.selectedProvider || wiki.providers[0]?.id || "google-ai-studio";
        const selectedProvider = wiki.providers.find((p) => p.id === wiki.providerId);
        if (selectedProvider && !wiki.model && selectedProvider.models?.length) {
          wiki.model = selectedProvider.models[0];
        }
      }
    }
  },
  { immediate: true },
);

watch(
  () => settings.selectedProvider,
  (newProviderId) => {
    if (newProviderId && newProviderId !== wiki.providerId) {
      wiki.providerId = newProviderId;
      const selectedProvider = wiki.providers.find((p) => p.id === newProviderId);
      if (selectedProvider && !wiki.model && selectedProvider.models?.length) {
        wiki.model = selectedProvider.models[0];
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <svg style="position: absolute; width: 0; height: 0" aria-hidden="true">
    <defs>
      <linearGradient id="qwikiAnimatedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
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
  </svg>
  <GlobalErrorModal />
  <main class="bg-background flex h-full w-full flex-col">
    <TopBar />

    <div class="flex-1 overflow-auto">
      <div v-if="currentPage === 'wiki'" class="flex h-full flex-col">
        <template v-if="wikiPageLoading.showNavigationLoading.value">
          <LoadingState class="flex-1" context="navigation" />
        </template>
        <template v-else-if="showWikiLoading">
          <LoadingState class="flex-1" context="wiki" />
          <div class="flex justify-center pb-4">
            <button
              class="text-muted-foreground hover:text-muted-foreground/80 py-2 text-xs sm:text-sm"
              @click="wiki.cancelPendingActions"
            >
              Cancel
            </button>
          </div>
        </template>
        <template v-else>
          <HomePage v-if="!wiki.content && !wiki.loading" />
          <WikiPage v-else />
        </template>
      </div>

      <div v-else-if="currentPage === 'settings'" class="settings-page-container flex h-full pb-4">
        <LoadingState
          v-if="settingsPageLoading.showNavigationLoading.value"
          class="flex-1"
          context="navigation"
        />
        <LoadingState
          v-else-if="settingsPageLoading.showPageLoading.value"
          class="flex-1"
          context="settings"
        />
        <SettingsPage v-else class="flex-1" />
      </div>

      <div v-else-if="currentPage === 'errorHistory'" class="flex h-full">
        <LoadingState
          v-if="errorHistoryPageLoading.showNavigationLoading.value"
          class="flex-1"
          context="navigation"
        />
        <LoadingState
          v-else-if="errorHistoryPageLoading.showPageLoading.value"
          class="flex-1"
          context="errorHistory"
        />
        <ErrorHistoryPage v-else class="flex-1" />
      </div>

      <div v-else-if="currentPage === 'savedWikis'" class="flex h-full">
        <SavedWikisPage class="flex-1" />
      </div>
    </div>
  </main>
</template>

<style>
.qwiki-gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
