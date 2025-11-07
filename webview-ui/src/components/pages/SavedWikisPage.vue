<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, shallowRef } from "vue";
import { useVscode } from "@/composables/useVscode";
import { useNavigation } from "@/composables/useNavigation";
import { useWikiStore } from "@/stores/wiki";
import { useEnvironmentStore } from "@/stores/environment";
import { useErrorStore } from "@/stores/error";
import LoadingState from "@/components/features/LoadingState.vue";
import LoadingView from "@/components/LoadingView.vue";
import WikiPreviewModal from "@/components/features/WikiPreviewModal.vue";
import WikiListItem from "@/components/features/WikiListItem.vue";
import ReadmeConfirmDialog from "@/components/features/ReadmeConfirmDialog.vue";
import Button from "@/components/ui/button.vue";
import SearchInput from "@/components/ui/SearchInput.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { useLoading } from "@/loading/useLoading";
import { useDelayedLoadingState } from "@/composables/useDelayedLoadingState";
import { createLogger } from "@/utilities/logging";
import { useDebouncedRef } from "@/composables/useDebouncedRef";
import type { ReadmePreview } from "../../../../src/domain/entities/ReadmeUpdate";

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
const wikiStore = useWikiStore();
const environmentStore = useEnvironmentStore();
const errorStore = useErrorStore();
const savedWikis = shallowRef<SavedWiki[]>([]);
const loading = ref(true);
const searchQuery = ref("");
const debouncedSearchQuery = useDebouncedRef(searchQuery, 300);
const previewWiki = ref<SavedWiki | null>(null);
const updateReadmeState = ref<"idle" | "loading" | "done">("idle");
const undoReadmeState = ref<"idle" | "loading">("idle");
const hasBackup = ref(false);
const showReadmeConfirmDialog = ref(false);
const readmePreview = ref<ReadmePreview | null>(null);
const changeSummary = ref<{
  added: number;
  updated: number;
  removed: number;
  preserved: number;
} | null>(null);

const savedWikisLoadingContext = useLoading("savedWikis");
const readmeUpdateLoadingContext = useLoading("readmeUpdate");

const isSavedWikisLoadingRaw = computed(
  () => loading.value || savedWikisLoadingContext.isActive.value,
);
const { displayLoading: isSavedWikisLoading } = useDelayedLoadingState(
  isSavedWikisLoadingRaw,
  computed(() => savedWikisLoadingContext.steps.value.length),
  { minDisplayTime: 300, perStepDelay: 100 },
);

const isReadmeUpdateLoadingRaw = computed(
  () => updateReadmeState.value === "loading" || readmeUpdateLoadingContext.isActive.value,
);
const { displayLoading: isReadmeUpdateLoading } = useDelayedLoadingState(
  isReadmeUpdateLoadingRaw,
  computed(() => readmeUpdateLoadingContext.steps.value.length),
  { minDisplayTime: 500, perStepDelay: 100 },
);

const isLoading = ref(false);
const loadTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null);
const scrollableContainer = ref<HTMLElement | null>(null);
const { currentPage } = useNavigation();

const preventScroll = (event: Event) => {
  if (isReadmeUpdateLoading.value) {
    event.preventDefault();
    event.stopPropagation();
  }
};

const filteredWikis = computed(() => {
  if (!debouncedSearchQuery.value.trim()) {
    return savedWikis.value;
  }

  const queryLower = debouncedSearchQuery.value.toLowerCase();
  const wikis = savedWikis.value;
  const result: SavedWiki[] = [];

  for (let i = 0; i < wikis.length; i++) {
    const wiki = wikis[i];
    if (
      wiki.title.toLowerCase().includes(queryLower) ||
      wiki.content.toLowerCase().includes(queryLower) ||
      wiki.tags.some((tag) => tag.toLowerCase().includes(queryLower))
    ) {
      result.push(wiki);
    }
  }

  return result;
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
  readmeUpdateLoadingContext.start("analyzingWikis");
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
    readmeUpdateLoadingContext.complete();
  }
};

const undoReadme = async () => {
  if (undoReadmeState.value === "loading" || !hasBackup.value) return;

  undoReadmeState.value = "loading";
  try {
    vscode.postMessage({
      command: "undoReadme",
    });
  } catch (err) {
    logger.error("Failed to undo README update", err);
    undoReadmeState.value = "idle";
  }
};

const showPreview = (wiki: SavedWiki, event: Event) => {
  event.stopPropagation();
  previewWiki.value = wiki;
};

const loadSavedWikis = async () => {
  if (isLoading.value) {
    return;
  }

  try {
    if (loadTimeoutId.value) {
      clearTimeout(loadTimeoutId.value);
      loadTimeoutId.value = null;
    }

    isLoading.value = true;
    loading.value = true;
    savedWikisLoadingContext.start("loadingWikis");
    savedWikisLoadingContext.advance("fetchingWikiData");

    loadTimeoutId.value = setTimeout(() => {
      if (isLoading.value) {
        logger.warn("getSavedWikis command timed out");
        errorStore.setError({
          message: "Failed to load saved wikis: Request timed out",
          code: "LOAD_TIMEOUT",
          context: {
            page: "savedWikis",
            operation: "loadSavedWikis",
          },
        });
        loading.value = false;
        isLoading.value = false;
        savedWikisLoadingContext.fail("Failed to load saved wikis: Request timed out");
        loadTimeoutId.value = null;
      }
    }, 10000);

    vscode.postMessage({ command: "getSavedWikis" });
  } catch {
    if (loadTimeoutId.value) {
      clearTimeout(loadTimeoutId.value);
      loadTimeoutId.value = null;
    }
    errorStore.setError({
      message: "Failed to load saved wikis",
      code: "LOAD_ERROR",
      context: {
        page: "savedWikis",
        operation: "loadSavedWikis",
      },
    });
    loading.value = false;
    isLoading.value = false;
    savedWikisLoadingContext.fail("Failed to load saved wikis");
  }
};

const openWiki = (wiki: SavedWiki) => {
  vscode.postMessage({
    command: "openFile",
    payload: { path: wiki.filePath },
  });
};

const deleteWiki = (wikiId: string, event: Event) => {
  event.stopPropagation();
  try {
    vscode.postMessage({
      command: "deleteWiki",
      payload: { wikiId },
    });
  } catch (err) {
    logger.error("Failed to delete wiki", err);
  }
};

const approveReadmeUpdate = async () => {
  try {
    vscode.postMessage({
      command: "approveReadmeUpdate",
    });
    showReadmeConfirmDialog.value = false;
    readmePreview.value = null;
    changeSummary.value = null;
    updateReadmeState.value = "loading";
    readmeUpdateLoadingContext.start("writingReadme");
  } catch (err) {
    logger.error("Failed to approve README update", err);
  }
};

const cancelReadmeUpdate = async () => {
  try {
    vscode.postMessage({
      command: "cancelReadmeUpdate",
    });
    showReadmeConfirmDialog.value = false;
    readmePreview.value = null;
    changeSummary.value = null;
    updateReadmeState.value = "idle";
  } catch (err) {
    logger.error("Failed to cancel README update", err);
  }
};

const handleMessage = (event: MessageEvent) => {
  const message = event.data;

  switch (message.command) {
    case "savedWikisLoaded":
      if (loadTimeoutId.value) {
        clearTimeout(loadTimeoutId.value);
        loadTimeoutId.value = null;
      }
      savedWikis.value = message.payload.wikis;
      savedWikisLoadingContext.advance("sortingWikis");
      savedWikisLoadingContext.advance("renderingWikis");
      loading.value = false;
      isLoading.value = false;
      savedWikisLoadingContext.complete();
      break;
    case "wikiDeleted":
      savedWikis.value = savedWikis.value.filter((w) => w.id !== message.payload.wikiId);
      break;
    case "readmeUpdateProgress":
      if (message.payload) {
        updateReadmeState.value = "loading";
      }
      break;
    case "readmeUpdatePreviewReady":
      readmePreview.value = message.payload.preview;
      changeSummary.value = message.payload.changeSummary;
      showReadmeConfirmDialog.value = true;
      updateReadmeState.value = "idle";
      readmeUpdateLoadingContext.complete();
      break;
    case "readmeUpdateApprovalRequested":
      break;
    case "readmeUpdateApproved":
      updateReadmeState.value = "loading";
      break;
    case "readmeUpdateCancelled":
      updateReadmeState.value = "idle";
      readmeUpdateLoadingContext.complete();
      break;
    case "readmeUpdated":
      if (message.payload.success) {
        updateReadmeState.value = "done";
        readmeUpdateLoadingContext.complete();
        setTimeout(() => {
          updateReadmeState.value = "idle";
        }, 2000);
      } else {
        updateReadmeState.value = "idle";
        readmeUpdateLoadingContext.complete();
      }
      undoReadmeState.value = "idle";
      vscode.postMessage({ command: "checkReadmeBackupState" });
      break;
    case "readmeBackupCreated":
      hasBackup.value = true;
      undoReadmeState.value = "idle";
      break;
    case "readmeBackupDeleted":
      hasBackup.value = false;
      undoReadmeState.value = "idle";
      break;
    case "readmeBackupState":
      hasBackup.value = message.payload?.hasBackup ?? false;
      break;
    case "showNotification":
      if (message.payload.type === "error") {
        if (loadTimeoutId.value) {
          clearTimeout(loadTimeoutId.value);
          loadTimeoutId.value = null;
        }
        errorStore.setError({
          message: message.payload.message,
          code: "NOTIFICATION_ERROR",
          context: {
            page: "savedWikis",
          },
        });
        loading.value = false;
        isLoading.value = false;
        savedWikisLoadingContext.fail(message.payload.message);
        undoReadmeState.value = "idle";
        updateReadmeState.value = "idle";
        if (isReadmeUpdateLoading.value) {
          readmeUpdateLoadingContext.fail(message.payload.message);
        }
      }
      break;
  }
};

const checkAndLoadWikis = () => {
  if (currentPage.value === "savedWikis" && environmentStore.extensionStatus.ready) {
    loadSavedWikis();
  }
};

watch(
  [currentPage, () => environmentStore.extensionStatus.ready],
  ([newPage, isReady]) => {
    if (newPage === "savedWikis" && isReady) {
      checkAndLoadWikis();
    }
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener("message", handleMessage);
  vscode.postMessage({ command: "checkReadmeBackupState" });
  checkAndLoadWikis();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
  if (loadTimeoutId.value) {
    clearTimeout(loadTimeoutId.value);
    loadTimeoutId.value = null;
  }
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-border flex-shrink-0 border-b px-4 py-4">
      <SearchInput v-model="searchQuery" placeholder="Search wikis..." />
    </div>

    <div class="flex flex-1 flex-col overflow-hidden">
      <div v-if="isSavedWikisLoading" class="flex h-full w-full">
        <LoadingState context="savedWikis" />
      </div>

      <EmptyState
        v-else-if="filteredWikis.length === 0"
        :title="debouncedSearchQuery ? 'No wikis found' : 'No saved wikis yet'"
        :description="
          debouncedSearchQuery
            ? 'Try a different search term.'
            : 'Generate and save some wikis to see them here.'
        "
        :show-action="!debouncedSearchQuery"
        action-text="Refresh"
        @action="loadSavedWikis"
      />

      <div
        v-else
        ref="scrollableContainer"
        :class="[
          'relative flex min-h-0 flex-1 flex-col',
          isReadmeUpdateLoading ? 'overflow-hidden' : 'overflow-y-auto',
        ]"
        @wheel="preventScroll"
        @touchmove="preventScroll"
      >
        <div
          v-for="(wikis, date) in groupedWikis"
          :key="date"
          class="border-border border-b last:border-b-0"
        >
          <div
            class="bg-muted/90 text-muted-foreground border-border sticky top-0 z-10 border-b px-4 py-2 text-xs font-medium uppercase tracking-wider backdrop-blur-sm"
          >
            {{ date }}
          </div>
          <div class="divide-border divide-y">
            <WikiListItem
              v-for="wiki in wikis"
              :key="wiki.id"
              v-memo="[wiki.id, wiki.title, wiki.tags.length]"
              :wiki="wiki"
              :selected="false"
              @preview="showPreview"
              @delete="deleteWiki"
              @open="openWiki"
            />
          </div>
        </div>
        <Transition
          enter-active-class="transition-opacity duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200 ease-in delay-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="isReadmeUpdateLoading"
            class="readme-loading-backdrop bg-muted/95 fixed inset-0 z-50 touch-none backdrop-blur-md will-change-[opacity,backdrop-filter]"
            @wheel.prevent
            @touchmove.prevent
            @scroll.prevent
          ></div>
        </Transition>
        <Transition
          enter-active-class="transition-opacity duration-200 ease-out delay-75"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="isReadmeUpdateLoading"
            class="readme-loading-content will-change-opacity fixed inset-0 z-50 flex touch-none items-center justify-center"
            @wheel.prevent
            @touchmove.prevent
            @scroll.prevent
          >
            <div class="w-full max-w-md px-4">
              <LoadingView
                :steps="readmeUpdateLoadingContext.steps.value"
                :current-step="readmeUpdateLoadingContext.state.value.step || 'analyzingWikis'"
              />
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <div
      v-if="filteredWikis.length > 0"
      class="border-border bg-background flex-shrink-0 border-t px-4 py-4"
    >
      <div class="flex gap-2">
        <Transition
          enter-active-class="undo-button-enter-active"
          enter-from-class="undo-button-enter-from"
          enter-to-class="undo-button-enter-to"
          leave-active-class="undo-button-leave-active"
          leave-from-class="undo-button-leave-from"
          leave-to-class="undo-button-leave-to"
        >
          <Button
            v-if="hasBackup"
            :disabled="undoReadmeState === 'loading' || updateReadmeState === 'loading'"
            class="undo-button bg-muted hover:bg-muted/80 text-foreground flex min-w-[3rem] flex-[0.2] items-center justify-center"
            @click="undoReadme"
          >
            <svg
              v-if="undoReadmeState === 'loading'"
              class="h-4 w-4 animate-spin"
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
              v-else
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </Button>
        </Transition>
        <Button
          :disabled="updateReadmeState === 'loading' || undoReadmeState === 'loading'"
          class="bg-foreground flex-1 text-sm transition-all"
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
                : "Update README"
          }}
        </Button>
      </div>
    </div>

    <WikiPreviewModal :wiki="previewWiki" @close="previewWiki = null" />

    <ReadmeConfirmDialog
      v-if="showReadmeConfirmDialog && readmePreview && changeSummary"
      :preview="readmePreview"
      :change-summary="changeSummary"
      :backup-original="hasBackup"
      :warnings="readmePreview.warnings"
      @confirm="approveReadmeUpdate"
      @cancel="cancelReadmeUpdate"
    />
  </div>
</template>

<style scoped>
.undo-button {
  will-change: transform, opacity;
  contain: layout style paint;
}

.undo-button-enter-active {
  transition:
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.undo-button-enter-from {
  opacity: 0;
  transform: translate3d(-1rem, 0, 0) scale(0.95);
}

.undo-button-enter-to {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

.undo-button-leave-active {
  transition:
    transform 120ms cubic-bezier(0.4, 0, 1, 1),
    opacity 120ms cubic-bezier(0.4, 0, 1, 1);
}

.undo-button-leave-from {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

.undo-button-leave-to {
  opacity: 0;
  transform: translate3d(-1rem, 0, 0) scale(0.95);
}

@media (prefers-reduced-motion: reduce) {
  .undo-button-enter-active,
  .undo-button-leave-active {
    transition: none;
  }

  .undo-button-enter-from,
  .undo-button-leave-to {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .readme-loading-backdrop,
  .readme-loading-content {
    transition: none !important;
  }
}
</style>
