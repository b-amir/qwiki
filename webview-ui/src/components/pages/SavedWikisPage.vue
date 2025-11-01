<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useVscode } from "@/composables/useVscode";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorDisplay from "@/components/features/ErrorDisplay.vue";
import { useLoading } from "@/loading/useLoading";
import { useNavigation } from "@/composables/useNavigation";
import { createLogger } from "@/utilities/logging";

interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

const vscode = useVscode();
const logger = createLogger("SavedWikisPage");
const navigationStatus = useNavigationStatusStore();
const savedWikis = ref<SavedWiki[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref("");
const savedWikisLoadingContext = useLoading("savedWikis");
const isSavedWikisLoading = computed(
  () => loading.value || savedWikisLoadingContext.isActive.value,
);

const isLoading = ref(false);
const { currentPage } = useNavigation();
let hasLoadedOnce = false;

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

const loadSavedWikis = async (force: boolean = false) => {
  if (isLoading.value || (hasLoadedOnce && !force)) {
    logger.debug("Already loading or already loaded, skipping request", {
      isLoading: isLoading.value,
      hasLoadedOnce,
      force,
    });
    return;
  }

  try {
    isLoading.value = true;
    loading.value = true;
    error.value = null;
    savedWikisLoadingContext.start("loading");
    vscode.postMessage({ command: "getSavedWikis" });
    hasLoadedOnce = true;
  } catch {
    error.value = "Failed to load saved wikis";
    loading.value = false;
    isLoading.value = false;
    navigationStatus.finish("savedWikis");
    savedWikisLoadingContext.fail("Failed to load saved wikis");
  }
};

const openWiki = (wiki: SavedWiki) => {
  vscode.postMessage({
    command: "openFile",
    payload: { path: wiki.filePath },
  });
};

const deleteWiki = async (wikiId: string, event: Event) => {
  event.stopPropagation();
  try {
    await vscode.postMessage({
      command: "deleteWiki",
      payload: { wikiId },
    });
  } catch (err) {
    logger.error("Failed to delete wiki", err);
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
      isLoading.value = false;
      navigationStatus.finish("savedWikis");
      savedWikisLoadingContext.complete();
      break;
    case "wikiDeleted":
      savedWikis.value = savedWikis.value.filter((w) => w.id !== message.payload.wikiId);
      break;
    case "showNotification":
      if (message.payload.type === "error") {
        error.value = message.payload.message;
        loading.value = false;
        isLoading.value = false;
        navigationStatus.finish("savedWikis");
        savedWikisLoadingContext.fail(message.payload.message);
      }
      break;
  }
};

watch(
  () => currentPage.value,
  (newPage, oldPage) => {
    if (newPage === "savedWikis" && oldPage !== "savedWikis" && !hasLoadedOnce) {
      logger.debug("Page activated, loading wikis");
      loadSavedWikis();
    }
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("message", handleMessage);
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-border flex-shrink-0 border-b px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-lg font-semibold">Project Wiki Collection</h1>
        <button
          class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
          @click="() => loadSavedWikis(true)"
        >
          Refresh
        </button>
      </div>

      <div class="mt-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search wikis..."
          class="border-input bg-muted text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full max-w-md rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <div v-if="isSavedWikisLoading" class="flex h-full w-full">
        <LoadingState context="savedWikis" />
      </div>

      <div v-else-if="error" class="flex h-full w-full items-center justify-center px-4">
        <ErrorDisplay :error="error" />
      </div>

      <div
        v-else-if="filteredWikis.length === 0"
        class="flex h-full w-full items-center justify-center px-4 py-6"
      >
        <div class="text-center">
          <div class="text-foreground mb-2 text-lg font-medium">
            {{ searchQuery ? "No wikis found" : "No saved wikis yet" }}
          </div>
          <div class="text-muted-foreground text-sm">
            {{
              searchQuery
                ? "Try a different search term."
                : "Generate and save some wikis to see them here."
            }}
          </div>
        </div>
      </div>

      <div v-else class="h-full overflow-y-auto">
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
              class="hover:bg-accent/50 group relative cursor-pointer transition-colors"
              @click="openWiki(wiki)"
            >
              <div class="p-4">
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
                      class="text-muted-foreground hover:text-destructive p-1 transition-colors"
                      title="Delete wiki"
                      @click="deleteWiki(wiki.id, $event)"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                    <div
                      class="text-muted-foreground group-hover:text-foreground translate-x-[-4px] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
