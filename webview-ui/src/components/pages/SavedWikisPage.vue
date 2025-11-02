<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useVscode } from "@/composables/useVscode";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import { useNavigation } from "@/composables/useNavigation";
import { useWikiStore } from "@/stores/wiki";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorDisplay from "@/components/features/ErrorDisplay.vue";
import WikiPreviewModal from "@/components/features/WikiPreviewModal.vue";
import WikiListItem from "@/components/features/WikiListItem.vue";
import Button from "@/components/ui/button.vue";
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
const wikiStore = useWikiStore();
const savedWikis = ref<SavedWiki[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref("");
const previewWiki = ref<SavedWiki | null>(null);
const updateReadmeState = ref<"idle" | "loading" | "done">("idle");

const savedWikisLoadingContext = useLoading("savedWikis");
const isSavedWikisLoading = computed(
  () => loading.value || savedWikisLoadingContext.isActive.value,
);

const isLoading = ref(false);
const { currentPage } = useNavigation();
let hasLoadedOnce = false;

const filteredWikis = computed(() => {
  if (!searchQuery.value.trim()) {
    return savedWikis.value;
  }

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

const updateReadme = async () => {
  if (filteredWikis.value.length === 0 || updateReadmeState.value === "loading") return;

  updateReadmeState.value = "loading";
  try {
    vscode.postMessage({
      command: "updateReadme",
      payload: {
        wikiIds: filteredWikis.value.map((w) => w.id),
        config: {
          providerId: wikiStore.providerId,
          model: wikiStore.model,
          backupOriginal: true,
        },
      },
    });
  } catch (err) {
    logger.error("Failed to update README", err);
    updateReadmeState.value = "idle";
  }
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
      break;
    case "readmeUpdated":
      if (message.payload.success) {
        updateReadmeState.value = "done";
        setTimeout(() => {
          updateReadmeState.value = "idle";
        }, 2000);
      } else {
        updateReadmeState.value = "idle";
      }
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
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search wikis..."
        class="border-input bg-muted text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
      />
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
        class="flex h-full w-full flex-col items-center justify-center px-4 py-6"
      >
        <div class="text-center">
          <div class="text-foreground mb-2 text-lg font-medium">
            {{ searchQuery ? "No wikis found" : "No saved wikis yet" }}
          </div>
          <div class="text-muted-foreground mb-4 text-sm">
            {{
              searchQuery
                ? "Try a different search term."
                : "Generate and save some wikis to see them here."
            }}
          </div>
          <button
            class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
            @click="() => loadSavedWikis(true)"
          >
            Refresh
          </button>
        </div>
      </div>

      <div v-else class="h-full overflow-y-auto">
        <div
          v-for="(wikis, date) in groupedWikis"
          :key="date"
          class="border-border border-b last:border-b-0"
        >
          <div
            class="bg-muted/50 text-muted-foreground sticky top-0 z-10 px-4 py-2 text-xs font-medium uppercase tracking-wider backdrop-blur-lg"
          >
            {{ date }}
          </div>
          <div class="divide-border divide-y">
            <WikiListItem
              v-for="wiki in wikis"
              :key="wiki.id"
              :wiki="wiki"
              :selected="false"
              @preview="showPreview"
              @delete="deleteWiki"
              @open="openWiki"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="filteredWikis.length > 0"
      class="border-border bg-background flex-shrink-0 border-t px-4 py-4"
    >
      <Button
        :disabled="updateReadmeState === 'loading'"
        class="bg-foreground w-full text-sm"
        @click="updateReadme"
      >
        <svg
          v-if="updateReadmeState === 'loading'"
          class="mr-2 h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <svg
          v-else-if="updateReadmeState === 'done'"
          class="mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {{
          updateReadmeState === "loading"
            ? "Updating..."
            : updateReadmeState === "done"
              ? "Done"
              : "Update README.md"
        }}
      </Button>
    </div>

    <WikiPreviewModal :wiki="previewWiki" @close="previewWiki = null" />
  </div>
</template>
