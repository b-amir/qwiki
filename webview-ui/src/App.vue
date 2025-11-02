<script setup lang="ts">
import { computed, watch } from "vue";
import { TopBar } from "@/components/layout";
import {
  HomePage,
  WikiPage,
  SettingsPage,
  ErrorHistoryPage,
  SavedWikisPage,
} from "@/components/pages";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { useEnvironmentStore } from "@/stores/environment";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import { useNavigation } from "@/composables/useNavigation";
import { useBatchMessageBridge } from "@/composables/useBatchMessageBridge";
import LoadingState from "@/components/features/LoadingState.vue";
import { useLoading } from "@/loading/useLoading";

const { currentPage } = useNavigation();
const wiki = useWikiStore();
const settings = useSettingsStore();
const environment = useEnvironmentStore();
const navigationStatus = useNavigationStatusStore();

wiki.init();
settings.init();
environment.init();
useBatchMessageBridge();

const environmentLoadingContext = useLoading("environment");
const navigationLoadingContext = useLoading("navigation");
const wikiLoadingContext = useLoading("wiki");
const settingsLoadingContext = useLoading("settings");
const errorHistoryLoadingContext = useLoading("errorHistory");

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

const navigationTarget = computed(() => navigationStatus.target);

const environmentLoading = computed(() => environmentLoadingContext.isActive.value);
const wikiNavigationLoading = computed(
  () =>
    navigationLoadingContext.isActive.value &&
    navigationTarget.value === "wiki" &&
    navigationStatus.isBackNavigation,
);
const settingsNavigationLoading = computed(
  () =>
    navigationLoadingContext.isActive.value &&
    navigationTarget.value === "settings" &&
    navigationStatus.isBackNavigation,
);
const errorHistoryNavigationLoading = computed(
  () =>
    navigationLoadingContext.isActive.value &&
    navigationTarget.value === "errorHistory" &&
    navigationStatus.isBackNavigation,
);

const showWikiLoading = computed(() => wiki.loading || wikiLoadingContext.isActive.value);
</script>

<template>
  <main class="bg-background flex h-full w-full flex-col">
    <TopBar />

    <div class="flex-1 overflow-auto">
      <div v-if="currentPage === 'wiki'" class="flex h-full flex-col">
        <LoadingState v-if="environmentLoading" class="flex-1" context="environment" />
        <LoadingState v-else-if="wikiNavigationLoading" class="flex-1" context="navigation" />
        <LoadingState v-else-if="showWikiLoading" class="flex-1" context="wiki" />
        <template v-else>
          <HomePage v-if="!wiki.content && !wiki.loading && !wiki.error" />
          <WikiPage v-else />
        </template>
      </div>

      <div v-else-if="currentPage === 'settings'" class="settings-page-container flex h-full pb-4">
        <LoadingState v-if="settingsNavigationLoading" class="flex-1" context="navigation" />
        <LoadingState
          v-else-if="settingsLoadingContext.isActive.value"
          class="flex-1"
          context="settings"
        />
        <SettingsPage v-else class="flex-1" />
      </div>

      <div v-else-if="currentPage === 'errorHistory'" class="flex h-full">
        <LoadingState v-if="errorHistoryNavigationLoading" class="flex-1" context="navigation" />
        <LoadingState
          v-else-if="errorHistoryLoadingContext.isActive.value"
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

.settings-page-container {
  padding-top: 0;
  padding-bottom: 0;
}
</style>
