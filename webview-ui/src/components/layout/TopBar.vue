<script setup lang="ts">
import { computed } from "vue";
import { useNavigation } from "@/composables/useNavigation";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { useEnvironmentStore } from "@/stores/environment";

const { currentPage, isValidating, navigateTo } = useNavigation();

const isSettingsValidating = computed(() => {
  return currentPage.value === "settings" && isValidating.value;
});
const wiki = useWikiStore();
const settings = useSettingsStore();
const environment = useEnvironmentStore();

const extensionReady = computed(() => environment.extensionStatus.ready);

const wikiTitle = computed(() => {
  if (wiki.content && typeof wiki.content === "string") {
    const headingMatch = wiki.content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
    const firstLine = wiki.content.split("\n")[0].trim();
    if (firstLine && !firstLine.startsWith("#")) {
      return firstLine;
    }
  }
  return "Wiki";
});

const goToHomePage = async () => {
  settings.cancelPendingActions();
  wiki.cancelPendingActions();
  await navigateTo("wiki", false);
};

const hasWikiContent = computed(() =>
  Boolean(wiki.content || wiki.loading || wiki.pendingAutoGenerate),
);
const isWikiDetail = computed(() => currentPage.value === "wiki" && hasWikiContent.value);
const isHomePage = computed(() => currentPage.value === "wiki" && !hasWikiContent.value);
const showBorder = computed(() => !isHomePage.value);

const pageTitle = computed(() => {
  if (isSettingsValidating.value) return "validating";
  if (currentPage.value === "settings") return "Settings";
  if (currentPage.value === "savedWikis") return "Project Wiki Collection";
  if (currentPage.value === "errorHistory") return "Error History";
  if (isWikiDetail.value) return wikiTitle.value;
  return "";
});

const buttonClass =
  "text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2";

const navigateToSettings = async () => {
  await navigateTo("settings");
};

const navigateToSavedWikis = async () => {
  await navigateTo("savedWikis");
};
</script>

<template>
  <div
    class="bg-background flex items-center px-2 py-3"
    :class="[isHomePage ? 'justify-end' : 'justify-between pl-3', showBorder ? 'border-b' : '']"
    :aria-busy="!extensionReady"
  >
    <template v-if="extensionReady">
      <div v-if="!isHomePage" class="flex items-center gap-2">
        <a
          :class="[buttonClass, isSettingsValidating ? 'cursor-not-allowed opacity-50' : '']"
          :title="isSettingsValidating ? 'Validating...' : 'Back to homepage'"
          @click="!isSettingsValidating && goToHomePage()"
        >
          <svg
            v-if="isSettingsValidating"
            class="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
              fill="none"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <svg v-else class="h-5 w-5" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="currentColor" />
            <path
              d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
              fill="currentColor"
            />
          </svg>
        </a>
        <span v-if="pageTitle" class="text-sm font-medium">{{ pageTitle }}</span>
      </div>

      <div class="flex items-center gap-1">
        <button :class="buttonClass" title="Settings" @click="navigateToSettings">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
          </svg>
        </button>
        <button :class="buttonClass" title="Saved Wikis" @click="navigateToSavedWikis">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </button>
      </div>
    </template>

    <template v-else>
      <div class="flex w-full items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="bg-muted/40 h-8 w-8 animate-pulse rounded-full"></div>
          <div class="bg-muted/30 h-3 w-28 animate-pulse rounded"></div>
        </div>
        <div class="flex items-center gap-3">
          <div class="bg-muted/40 h-8 w-8 animate-pulse rounded-md"></div>
          <div class="bg-muted/40 h-8 w-8 animate-pulse rounded-md"></div>
          <div class="bg-muted/30 h-3 w-28 animate-pulse rounded"></div>
        </div>
      </div>
    </template>
  </div>
</template>
