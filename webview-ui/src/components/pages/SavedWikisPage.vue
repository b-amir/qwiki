<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useVscode } from "@/composables/useVscode";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import { useNavigation } from "@/composables/useNavigation";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorDisplay from "@/components/features/ErrorDisplay.vue";
import WikiBulkActions from "@/components/features/WikiBulkActions.vue";
import WikiFilters from "@/components/features/WikiFilters.vue";
import WikiPreviewModal from "@/components/features/WikiPreviewModal.vue";
import WikiListItem from "@/components/features/WikiListItem.vue";
import { useLoading } from "@/loading/useLoading";
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
const selectedWikis = ref<Set<string>>(new Set());
const previewWiki = ref<SavedWiki | null>(null);
const fileTypeFilter = ref("");
const dateFilter = ref("");
const relevanceFilter = ref("");
const sortBy = ref<"title" | "date" | "size" | "relevance">("date");
const sortOrder = ref<"asc" | "desc">("desc");

const savedWikisLoadingContext = useLoading("savedWikis");
const isSavedWikisLoading = computed(
  () => loading.value || savedWikisLoadingContext.isActive.value,
);

const isLoading = ref(false);
const { currentPage } = useNavigation();
let hasLoadedOnce = false;

const filteredWikis = computed(() => {
  let result = savedWikis.value;

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (wiki) =>
        wiki.title.toLowerCase().includes(query) ||
        wiki.content.toLowerCase().includes(query) ||
        wiki.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  if (fileTypeFilter.value) {
    result = result.filter((wiki) => wiki.filePath.endsWith(fileTypeFilter.value));
  }

  if (dateFilter.value) {
    const now = new Date();
    result = result.filter((wiki) => {
      const wikiDate = new Date(wiki.createdAt);
      const diffTime = now.getTime() - wikiDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      switch (dateFilter.value) {
        case "today":
          return diffDays < 1;
        case "week":
          return diffDays < 7;
        case "month":
          return diffDays < 30;
        default:
          return true;
      }
    });
  }

  const sorted = [...result].sort((a, b) => {
    let comparison = 0;

    switch (sortBy.value) {
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
      case "date":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "size":
        comparison = a.content.length - b.content.length;
        break;
      case "relevance":
        comparison = 0;
        break;
    }

    return sortOrder.value === "asc" ? comparison : -comparison;
  });

  return sorted;
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

const selectWiki = (wikiId: string, checked: boolean) => {
  if (checked) {
    selectedWikis.value.add(wikiId);
  } else {
    selectedWikis.value.delete(wikiId);
  }
};

const selectAll = () => {
  if (selectedWikis.value.size === filteredWikis.value.length) {
    selectedWikis.value.clear();
  } else {
    filteredWikis.value.forEach((wiki) => selectedWikis.value.add(wiki.id));
  }
};

const createAggregation = () => {
  if (selectedWikis.value.size === 0) return;
  vscode.postMessage({
    command: "navigate",
    payload: { page: "wikiAggregation", preselectedWikis: Array.from(selectedWikis.value) },
  });
};

const updateReadme = () => {
  if (selectedWikis.value.size === 0) return;
  vscode.postMessage({
    command: "navigate",
    payload: { page: "readmeUpdate", preselectedWikis: Array.from(selectedWikis.value) },
  });
};

const exportWikis = () => {
  if (selectedWikis.value.size === 0) return;
  vscode.postMessage({
    command: "exportWikis",
    payload: { wikiIds: Array.from(selectedWikis.value) },
  });
};

const showPreview = (wiki: SavedWiki, event: Event) => {
  event.stopPropagation();
  previewWiki.value = wiki;
};

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
      selectedWikis.value.delete(message.payload.wikiId);
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

      <div class="mt-4 flex items-center gap-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search wikis..."
          class="border-input bg-muted text-foreground placeholder:text-muted-foreground focus-visible:ring-ring max-w-md flex-1 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
        <WikiFilters
          :file-type-filter="fileTypeFilter"
          :date-filter="dateFilter"
          :relevance-filter="relevanceFilter"
          @update:file-type-filter="fileTypeFilter = $event"
          @update:date-filter="dateFilter = $event"
          @update:relevance-filter="relevanceFilter = $event"
        />
        <div class="flex items-center gap-2">
          <label class="text-muted-foreground text-xs">Sort:</label>
          <select
            v-model="sortBy"
            class="border-input bg-muted text-foreground focus-visible:ring-ring rounded-md border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1"
          >
            <option value="title">Title</option>
            <option value="date">Date</option>
            <option value="size">Size</option>
            <option value="relevance">Relevance</option>
          </select>
          <button
            class="border-input bg-muted text-foreground hover:bg-accent rounded-md border px-2 py-1 text-xs"
            @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
          >
            {{ sortOrder === "asc" ? "↑" : "↓" }}
          </button>
        </div>
      </div>
    </div>

    <WikiBulkActions
      v-if="selectedWikis.size > 0"
      :selected-count="selectedWikis.size"
      @create-aggregation="createAggregation"
      @update-readme="updateReadme"
      @export="exportWikis"
    />

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
        <div class="border-border bg-background sticky top-0 z-10 border-b px-4 py-2">
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              :checked="selectedWikis.size === filteredWikis.length && filteredWikis.length > 0"
              :indeterminate="selectedWikis.size > 0 && selectedWikis.size < filteredWikis.length"
              @change="selectAll()"
            />
            Select All
          </label>
        </div>
        <div
          v-for="(wikis, date) in groupedWikis"
          :key="date"
          class="border-border border-b last:border-b-0"
        >
          <div
            class="bg-muted/30 text-muted-foreground sticky top-[41px] z-10 px-4 py-2 text-xs font-medium uppercase tracking-wider"
          >
            {{ date }}
          </div>
          <div class="divide-border divide-y">
            <WikiListItem
              v-for="wiki in wikis"
              :key="wiki.id"
              :wiki="wiki"
              :selected="selectedWikis.has(wiki.id)"
              @select="selectWiki"
              @preview="showPreview"
              @delete="deleteWiki"
              @open="openWiki"
            />
          </div>
        </div>
      </div>
    </div>

    <WikiPreviewModal :wiki="previewWiki" @close="previewWiki = null" />
  </div>
</template>
