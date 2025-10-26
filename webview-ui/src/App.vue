<script setup lang="ts">
import { computed, watch } from "vue";
import { TopBar } from "@/components/layout";
import { HomePage, WikiPage, SettingsPage } from "@/components/pages";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { useNavigation } from "@/composables/useNavigation";

const { currentPage } = useNavigation();
const wiki = useWikiStore();
const settings = useSettingsStore();

// Initialize wiki store
wiki.init();

// Initialize settings store
settings.init();

const currentModels = computed(
  () => wiki.providers.find((p) => p.id === wiki.providerId)?.models || [],
);

// Watch for provider changes to update model selection
watch(
  () => wiki.providerId,
  () => {
    if (!currentModels.value.includes(wiki.model)) {
      wiki.model = currentModels.value[0] || "";
    }
  },
  { immediate: true },
);

// Sync selected provider when providers are loaded
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
</script>

<template>
  <main class="bg-background flex h-full w-full flex-col">
    <!-- TopBar component -->
    <TopBar />

    <!-- Content area -->
    <div class="flex-1 overflow-auto py-3">
      <!-- Debug: Show current page -->
      <div v-if="false" class="mb-2 text-xs text-red-500">Current page: {{ currentPage }}</div>

      <!-- Wiki Page -->
      <div v-if="currentPage === 'wiki'" class="flex h-full flex-col">
        <!-- Homepage content when no wiki is generated -->
        <HomePage v-if="!wiki.content && !wiki.loading && !wiki.error" />

        <!-- Wiki content when generated -->
        <WikiPage v-else />
      </div>

      <!-- Settings Page -->
      <div v-else-if="currentPage === 'settings'">
        <SettingsPage />
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
