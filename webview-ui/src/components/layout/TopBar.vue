<script setup lang="ts">
import { computed } from "vue";
import { useNavigation } from "@/composables/useNavigation";
import { useWikiStore } from "@/stores/wiki";
import { useSettingsStore } from "@/stores/settings";

const { currentPage, setPage } = useNavigation();
const wiki = useWikiStore();
const settings = useSettingsStore();

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
</template>
