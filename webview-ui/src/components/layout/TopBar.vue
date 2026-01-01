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
    class="bg-background flex min-w-0 items-center overflow-hidden px-2 py-3"
    :class="[isHomePage ? 'justify-end' : 'justify-between pl-3', showBorder ? 'border-b' : '']"
    :aria-busy="!extensionReady"
  >
    <template v-if="extensionReady">
      <div v-if="!isHomePage" class="flex min-w-0 items-center gap-2">
        <a
          :class="[buttonClass, isSettingsValidating ? 'cursor-not-allowed opacity-50' : '']"
          :title="isSettingsValidating ? 'Validating...' : 'Back to homepage'"
          @click="!isSettingsValidating && goToHomePage()"
        >
          <svg
            v-if="isSettingsValidating"
            class="h-5 w-5 shrink-0 animate-spin"
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
          <svg
            v-else
            class="h-5 w-5 shrink-0"
            viewBox="0 0 1024 1024"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="currentColor" />
            <path
              d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
              fill="currentColor"
            />
          </svg>
        </a>
        <span v-if="pageTitle" class="min-w-0 truncate text-sm font-medium">{{ pageTitle }}</span>
      </div>

      <div class="flex shrink-0 items-center gap-1">
        <button :class="buttonClass" title="Settings" @click="navigateToSettings">
          <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
        </button>
        <button :class="buttonClass" title="Saved Wikis" @click="navigateToSavedWikis">
          <svg
            class="h-[18px] w-[18px] shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              d="M4.5 8.7111C4.5 8.10998 4.5 7.80941 4.58582 7.52598C4.67163 7.24255 4.83835 6.99247 5.1718 6.4923L5.31253 6.2812C5.89382 5.40927 6.18447 4.9733 6.62665 4.73665C7.06884 4.5 7.5928 4.5 8.64074 4.5H15.3593C16.4072 4.5 16.9312 4.5 17.3733 4.73665C17.8155 4.9733 18.1062 5.40927 18.6875 6.2812L18.8282 6.4923C19.1616 6.99247 19.3284 7.24255 19.4142 7.52598C19.5 7.80941 19.5 8.10998 19.5 8.7111V15.5C19.5 17.3856 19.5 18.3284 18.9142 18.9142C18.3284 19.5 17.3856 19.5 15.5 19.5H8.5C6.61438 19.5 5.67157 19.5 5.08579 18.9142C4.5 18.3284 4.5 17.3856 4.5 15.5V8.7111Z"
            />
            <path d="M4.5 9.5H19.5" stroke-linecap="round" />
            <path
              d="M9.5 9.65C9.5 9.56716 9.56716 9.5 9.65 9.5H14.35C14.4328 9.5 14.5 9.56716 14.5 9.65V13.7052C14.5 14.055 14.1184 14.271 13.8185 14.0911L12.1286 13.0772C12.0495 13.0297 11.9505 13.0297 11.8714 13.0772L10.1815 14.0911C9.88159 14.271 9.5 14.055 9.5 13.7052V9.65Z"
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
