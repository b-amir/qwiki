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

const { currentPage } = useNavigation();
const wiki = useWikiStore();
const settings = useSettingsStore();
const environment = useEnvironmentStore();
const navigationStatus = useNavigationStatusStore();

wiki.init();
settings.init();
environment.init();
useBatchMessageBridge();

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
    if (wiki.providers.length > 0 && !settings.selectedProvider) {
      const withKey = wiki.providers.find((p) => p.hasKey);
      settings.selectedProvider = withKey?.id || "google-ai-studio";
    }
  },
  { immediate: true },
);

const environmentLoading = computed(() => !environment.isReady);
const navigationLoading = computed(() => navigationStatus.isNavigating);
const wikiNavigationLoading = computed(
  () => navigationLoading.value && navigationStatus.target === "wiki",
);
const settingsNavigationLoading = computed(
  () => navigationLoading.value && navigationStatus.target === "settings",
);
const savedWikisNavigationLoading = computed(
  () => navigationLoading.value && navigationStatus.target === "savedWikis",
);
const errorHistoryNavigationLoading = computed(
  () => navigationLoading.value && navigationStatus.target === "errorHistory",
);

const environmentSteps = computed(() => {
  if (environment.steps.length > 0) {
    return environment.steps;
  }
  return [
    {
      key: "extensionLoading",
      text: environment.extensionStatus.message || "Preparing Qwiki services...",
    },
  ];
});

const environmentCurrentStep = computed(() => {
  if (environment.currentStep) {
    return environment.currentStep;
  }
  return environmentSteps.value[0]?.key || "extensionLoading";
});
</script>

<template>
  <main class="bg-background flex h-full w-full flex-col">
    <TopBar />

    <div class="flex-1 overflow-auto py-3">
      <div v-if="currentPage === 'wiki'" class="flex h-full flex-col">
        <LoadingState
          v-if="environmentLoading || wikiNavigationLoading"
          class="flex-1"
          :steps="environmentSteps"
          :current-step="environmentCurrentStep"
          density="low"
        />
        <template v-else>
          <HomePage v-if="!wiki.content && !wiki.loading && !wiki.error" />
          <WikiPage v-else />
        </template>
      </div>

      <div v-else-if="currentPage === 'settings'">
        <LoadingState
          v-if="settingsNavigationLoading"
          class="flex-1"
          :steps="[
            { text: 'Loading settings...', key: 'loading' },
            { text: 'Fetching providers...', key: 'fetching' },
            { text: 'Preparing configuration...', key: 'preparing' }
          ]"
          :current-step="'loading'"
          density="low"
        />
        <SettingsPage v-else />
      </div>

      <div v-else-if="currentPage === 'errorHistory'">
        <LoadingState
          v-if="errorHistoryNavigationLoading"
          class="flex-1"
          :steps="[
            { text: 'Gathering error history...', key: 'loading' },
            { text: 'Preparing view...', key: 'preparing' }
          ]"
          :current-step="'loading'"
          density="low"
        />
        <ErrorHistoryPage v-else />
      </div>

      <div v-else-if="currentPage === 'savedWikis'">
        <LoadingState
          v-if="savedWikisNavigationLoading"
          class="flex-1"
          :steps="[
            { text: 'Loading saved wikis...', key: 'loading' },
            { text: 'Preparing entries...', key: 'preparing' }
          ]"
          :current-step="'loading'"
          density="low"
        />
        <SavedWikisPage v-else />
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
