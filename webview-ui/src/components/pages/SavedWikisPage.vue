<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useVscode } from "@/composables/useVscode";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import LoadingState from "@/components/features/LoadingState.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";

interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

const vscode = useVscode();
const navigationStatus = useNavigationStatusStore();
const savedWikis = ref<SavedWiki[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const selectedWiki = ref<SavedWiki | null>(null);
const searchQuery = ref("");

const filteredWikis = computed(() => {
  if (!searchQuery.value.trim()) return savedWikis.value;

  const query = searchQuery.value.toLowerCase();
  return savedWikis.value.filter(
    (wiki) =>
      wiki.title.toLowerCase().includes(query) ||
      wiki.content.toLowerCase().includes(query) ||
      wiki.tags.some((tag) => tag.toLowerCase().includes(query)),
  );
});

const groupedWikis = computed(() => {
  const groups: Record<string, SavedWiki[]> = {};

  filteredWikis.value.forEach((wiki) => {
    const date = new Date(wiki.createdAt).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(wiki);
  });

  return groups;
});

const loadSavedWikis = async () => {
  try {
    loading.value = true;
    error.value = null;
    vscode.postMessage({ command: "getSavedWikis" });
  } catch (err) {
    error.value = "Failed to load saved wikis";
    loading.value = false;
    navigationStatus.finish("savedWikis");
  }
};

const deleteWiki = async (wikiId: string) => {
  try {
    await vscode.postMessage({
      command: "deleteWiki",
      payload: { wikiId },
    });
  } catch (err) {
    console.error("[QWIKI] SavedWikisPage: Failed to delete wiki", err);
  }
};

const formatCreatedAt = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const handleMessage = (event: MessageEvent) => {
  const message = event.data;

  switch (message.command) {
    case "savedWikisLoaded":
      savedWikis.value = message.payload.wikis;
      loading.value = false;
      navigationStatus.finish("savedWikis");
      break;
    case "wikiDeleted":
      savedWikis.value = savedWikis.value.filter((w) => w.id !== message.payload.wikiId);
      if (selectedWiki.value?.id === message.payload.wikiId) {
        selectedWiki.value = null;
      }
      break;
    case "showNotification":
      if (message.payload.type === "error") {
        error.value = message.payload.message;
        loading.value = false;
        navigationStatus.finish("savedWikis");
      }
      break;
  }
};

onMounted(() => {
  loadSavedWikis();
  window.addEventListener("message", handleMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-border flex-shrink-0 border-b p-4">
      <div class="flex items-center justify-between gap-4">
        <h1 class="text-lg font-semibold">Project Wiki Collection</h1>
        <button class="text-muted-foreground hover:text-foreground text-sm" @click="loadSavedWikis">
          Refresh
        </button>
      </div>

      <div class="mt-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search wikis..."
          class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <div v-if="loading" class="flex h-full w-full">
        <LoadingState
          :steps="[
            { text: 'Loading saved wikis...', key: 'loading' },
            { text: 'Preparing entries...', key: 'preparing' },
          ]"
          :current-step="'loading'"
          density="low"
        />
      </div>

      <div
        v-else-if="error"
        class="text-destructive flex h-full w-full items-center justify-center"
      >
        {{ error }}
      </div>

      <div
        v-else-if="filteredWikis.length === 0"
        class="text-muted-foreground flex h-full w-full items-center justify-center"
      >
        <div class="text-center">
          <div class="mb-2 text-lg font-medium">
            {{ searchQuery ? "No wikis found" : "No saved wikis yet" }}
          </div>
          <div class="text-sm">
            {{
              searchQuery
                ? "Try a different search term."
                : "Generate and save some wikis to see them here."
            }}
          </div>
        </div>
      </div>

      <div v-else class="overflow-auto">
        <div
          v-for="(wikis, date) in groupedWikis"
          :key="date"
          class="border-border border-b last:border-b-0"
        >
          <div
            class="bg-muted/30 text-muted-foreground sticky top-0 z-10 px-4 py-2 text-xs font-medium uppercase tracking-wider"
          >
            {{ date }}
          </div>
          <div class="divide-border divide-y">
            <div
              v-for="wiki in wikis"
              :key="wiki.id"
              class="hover:bg-muted/50 cursor-pointer p-4 transition-colors"
              @click="selectedWiki = selectedWiki?.id === wiki.id ? null : wiki"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="mb-1 truncate text-sm font-medium">{{ wiki.title }}</div>
                  <div class="text-muted-foreground mb-2 text-xs">
                    {{ formatCreatedAt(wiki.createdAt) }}
                  </div>
                  <div v-if="wiki.tags.length > 0" class="flex flex-wrap gap-1">
                    <span
                      v-for="tag in wiki.tags.slice(0, 3)"
                      :key="tag"
                      class="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs"
                    >
                      {{ tag }}
                    </span>
                    <span v-if="wiki.tags.length > 3" class="text-muted-foreground text-xs">
                      +{{ wiki.tags.length - 3 }}
                    </span>
                  </div>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                  <button
                    class="text-destructive hover:text-destructive/80 text-xs"
                    @click.stop="deleteWiki(wiki.id)"
                  >
                    Delete
                  </button>
                  <div class="text-muted-foreground">
                    <svg
                      class="h-4 w-4 transition-transform"
                      :class="{ 'rotate-180': selectedWiki?.id === wiki.id }"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div v-if="selectedWiki?.id === wiki.id" class="border-border mt-4 border-t pt-4">
                <div class="prose prose-sm max-w-none">
                  <MarkdownRenderer :content="wiki.content" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
