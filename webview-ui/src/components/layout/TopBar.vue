<script setup lang="ts">
import { computed } from "vue";
import { useNavigation } from "@/composables/useNavigation";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";
import { useErrorHistoryStore } from "@/stores/errorHistory";

const { currentPage, setPage } = useNavigation();
const wiki = useWikiStore();
const errorHistory = useErrorHistoryStore();
const settings = useSettingsStore();

const errorCount = computed(() => errorHistory.getErrorCount());

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

const handleSettingsBack = () => {
  wiki.clearContent();
  wiki.error = "";
  wiki.loading = false;
  setPage("wiki");
};

const handleWikiBack = () => {
  wiki.clearContent();
};
</script>

<template>
  <!-- Settings Page Header -->
  <div
    v-if="currentPage === 'settings'"
    class="bg-background flex items-center gap-1 border-b px-2 py-3 pl-3"
  >
    <div class="flex items-center gap-2">
      <a
        class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
        title="Back"
        @click="handleSettingsBack"
      >
        <svg class="h-5 w-5" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
          <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="currentColor" />
          <path
            d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
            fill="currentColor"
          />
        </svg>
      </a>
    </div>

    <span class="text-sm font-medium">Settings</span>
  </div>

  <!-- Wiki Page Header -->
  <div
    v-if="currentPage === 'wiki' && (wiki.content || wiki.loading || wiki.error)"
    class="bg-background flex items-center gap-1 border-b px-2 py-3 pl-3"
  >
    <div class="flex items-center gap-2">
      <a
        class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
        title="Back to homepage"
        @click="handleWikiBack"
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

  <!-- Error History Page Header -->
  <div
    v-if="currentPage === 'errorHistory'"
    class="bg-background flex items-center gap-1 border-b px-2 py-3 pl-3"
  >
    <div class="flex items-center gap-2">
      <a
        class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
        title="Back to homepage"
        @click="() => setPage('wiki')"
      >
        <svg class="h-5 w-5" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
          <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="currentColor" />
          <path
            d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
            fill="currentColor"
          />
        </svg>
      </a>
    </div>

    <span class="text-sm font-medium">Error History</span>
  </div>

  <!-- Default Header (for homepage) -->
  <div
    v-if="!['settings', 'wiki', 'errorHistory'].includes(currentPage)"
    class="bg-background flex items-center justify-between border-b px-2 py-3 pl-3"
  >
    <div class="flex items-center gap-2">
      <a
        class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
        title="Wiki"
        @click="() => setPage('wiki')"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 12l2-2m0 0l7-7 7 7"
          />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7" />
        </svg>
        Wiki
      </a>
      <button
        class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
        :class="{ 'text-destructive': errorCount > 0 }"
        @click="() => setPage('errorHistory')"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Errors
        <span
          v-if="errorCount > 0"
          class="bg-destructive text-destructive-foreground ml-1 rounded-full px-1.5 py-0.5 text-xs"
        >
          {{ errorCount }}
        </span>
      </button>
      <button
        class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
        @click="() => setPage('settings')"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
        </svg>
        Settings
      </button>
    </div>
  </div>
</template>
