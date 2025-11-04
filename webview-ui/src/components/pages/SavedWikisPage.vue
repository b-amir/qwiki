<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, shallowRef } from "vue";
import { useVscode } from "@/composables/useVscode";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import { useNavigation } from "@/composables/useNavigation";
import { useWikiStore } from "@/stores/wiki";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorModal from "@/components/features/ErrorModal.vue";
import WikiPreviewModal from "@/components/features/WikiPreviewModal.vue";
import WikiListItem from "@/components/features/WikiListItem.vue";
import ReadmeConfirmDialog from "@/components/features/ReadmeConfirmDialog.vue";
import Button from "@/components/ui/button.vue";
import SearchInput from "@/components/ui/SearchInput.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { useLoading } from "@/loading/useLoading";
import { createLogger } from "@/utilities/logging";
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
const navigationStatus = useNavigationStatusStore();
const wikiStore = useWikiStore();
const savedWikis = shallowRef<SavedWiki[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const errorModalOpen = ref(false);
const searchQuery = ref("");
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
const isSavedWikisLoading = computed(
  () => loading.value || savedWikisLoadingContext.isActive.value,
);
const isReadmeUpdateLoading = computed(
  () => updateReadmeState.value === "loading" || readmeUpdateLoadingContext.isActive.value,
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
    errorModalOpen.value = true;
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
      savedWikis.value = message.payload.wikis;
      loading.value = false;
      isLoading.value = false;
      navigationStatus.finish("savedWikis");
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
        error.value = message.payload.message;
        errorModalOpen.value = true;
        loading.value = false;
        isLoading.value = false;
        navigationStatus.finish("savedWikis");
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
  vscode.postMessage({ command: "checkReadmeBackupState" });
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-border flex-shrink-0 border-b px-4 py-4">
      <SearchInput v-model="searchQuery" placeholder="Search wikis..." />
    </div>

    <div class="flex-1 overflow-hidden">
      <div v-if="isSavedWikisLoading" class="flex h-full w-full">
        <LoadingState context="savedWikis" />
      </div>

      <EmptyState
        v-else-if="filteredWikis.length === 0"
        :title="searchQuery ? 'No wikis found' : 'No saved wikis yet'"
        :description="
          searchQuery
            ? 'Try a different search term.'
            : 'Generate and save some wikis to see them here.'
        "
        :show-action="!searchQuery"
        action-text="Refresh"
        @action="() => loadSavedWikis(true)"
      />

      <div v-else class="relative h-full overflow-y-auto">
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
            class="readme-loading-backdrop bg-muted/95 absolute inset-0 z-50 backdrop-blur-md will-change-[opacity,backdrop-filter]"
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
            class="readme-loading-content will-change-opacity absolute inset-0 z-50 flex items-center justify-center"
          >
            <div class="w-full max-w-md px-4">
              <LoadingState context="readmeUpdate" />
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

    <ErrorModal
      v-if="error"
      v-model="errorModalOpen"
      :error="error"
      @close="
        () => {
          error = null;
          errorModalOpen = false;
        }
      "
    />

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
