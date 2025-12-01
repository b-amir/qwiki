import { ref, computed, onMounted, onBeforeUnmount, watch, shallowRef } from "vue";
import { useVscode } from "@/composables/useVscode";
import { useNavigation } from "@/composables/useNavigation";
import { useWikiStore } from "@/stores/wiki";
import { useEnvironmentStore } from "@/stores/environment";
import { useErrorStore } from "@/stores/error";
import { useLoading } from "@/loading/useLoading";
import { useDelayedLoadingState } from "@/composables/useDelayedLoadingState";
import { createLogger } from "@/utilities/logging";
import { useDebouncedRef } from "@/composables/useDebouncedRef";
import { ErrorCodes, ErrorMessages } from "@/constants/ErrorCodes";
import { MessageStrings } from "@/constants/MessageConstants";
import { useVirtualList } from "@vueuse/core";

export interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
}

export type ReadmeUpdateState = "idle" | "loading" | "done";
export type UndoReadmeState = "idle" | "loading";

type ErrorCodeValue = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const defaultSuggestions = [MessageStrings.retrySavedWikis, MessageStrings.checkLogs];

export function useSavedWikisPage() {
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
  const updateReadmeState = ref<ReadmeUpdateState>("idle");
  const undoReadmeState = ref<UndoReadmeState>("idle");
  const hasBackup = ref(false);
  const isReadmeSynced = ref(false);
  const diffAvailable = ref(false);
  const readmeLastUpdatedAt = ref<number | null>(null);
  const isLoading = ref(false);
  const loadTimeoutId = ref<number | null>(null);
  const scrollableContainer = ref<HTMLElement | null>(null);
  const { currentPage } = useNavigation();

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

  interface VirtualListItem {
    type: "header" | "wiki";
    date?: string;
    wiki?: SavedWiki;
    id: string;
  }

  const virtualListItems = computed(() => {
    const items: VirtualListItem[] = [];
    const groups = groupedWikis.value;

    for (const [date, wikis] of Object.entries(groups)) {
      items.push({ type: "header", date, id: `header-${date}` });
      for (const wiki of wikis) {
        items.push({ type: "wiki", wiki, id: wiki.id });
      }
    }

    return items;
  });

  const { list, containerProps, wrapperProps } = useVirtualList(virtualListItems, {
    itemHeight: 80,
    overscan: 5,
  });

  const setError = (
    code: ErrorCodeValue,
    fallbackMessage: string,
    context: Record<string, unknown>,
    originalError?: unknown,
  ) => {
    const resolvedMessage = ErrorMessages[code as keyof typeof ErrorMessages] ?? fallbackMessage;
    errorStore.setError({
      message: resolvedMessage,
      code,
      suggestions: defaultSuggestions,
      context: {
        page: "savedWikis",
        component: "SavedWikisPage",
        ...context,
      },
      originalError: originalError instanceof Error ? originalError.message : undefined,
    });
  };

  const updateReadme = async () => {
    if (filteredWikis.value.length === 0 || updateReadmeState.value === "loading") {
      return;
    }

    updateReadmeState.value = "loading";
    isReadmeSynced.value = false;
    diffAvailable.value = false;
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
    } catch (error) {
      logger.error("Failed to update README", error);
      setError(
        ErrorCodes.readmeUpdateFailed,
        "Failed to update README",
        {
          operation: "updateReadme",
        },
        error,
      );
      updateReadmeState.value = "idle";
      readmeUpdateLoadingContext.complete();
    }
  };

  const undoReadme = async () => {
    if (undoReadmeState.value === "loading" || !hasBackup.value) {
      return;
    }

    undoReadmeState.value = "loading";
    try {
      vscode.postMessage({
        command: "undoReadme",
      });
    } catch (error) {
      logger.error("Failed to undo README update", error);
      setError(
        ErrorCodes.readmeUndoFailed,
        "Failed to undo README update",
        {
          operation: "undoReadme",
        },
        error,
      );
      undoReadmeState.value = "idle";
    }
  };

  const showPreview = (wiki: SavedWiki, event: Event) => {
    event.stopPropagation();
    previewWiki.value = wiki;
  };

  const optimisticDeletes = ref<Map<string, SavedWiki>>(new Map());

  const deleteWiki = (wikiId: string, event: Event) => {
    event.stopPropagation();
    const wikiToDelete = savedWikis.value.find((w) => w.id === wikiId);
    if (!wikiToDelete) {
      return;
    }

    optimisticDeletes.value.set(wikiId, wikiToDelete);
    savedWikis.value = savedWikis.value.filter((w) => w.id !== wikiId);

    try {
      vscode.postMessage({
        command: "deleteWiki",
        payload: { wikiId },
      });
    } catch (error) {
      logger.error("Failed to delete wiki", error);
      if (wikiToDelete) {
        savedWikis.value.push(wikiToDelete);
        optimisticDeletes.value.delete(wikiId);
      }
      setError(
        ErrorCodes.savedWikisDeleteFailed,
        "Failed to delete saved wiki",
        {
          operation: "deleteWiki",
        },
        error,
      );
    }
  };

  const openWiki = (wiki: SavedWiki) => {
    vscode.postMessage({
      command: "openFile",
      payload: { path: wiki.filePath },
    });
  };

  const loadSavedWikis = async () => {
    if (isLoading.value) {
      return;
    }

    try {
      if (loadTimeoutId.value) {
        window.clearTimeout(loadTimeoutId.value);
        loadTimeoutId.value = null;
      }

      isLoading.value = true;
      loading.value = true;
      savedWikisLoadingContext.start("loadingWikis");
      savedWikisLoadingContext.advance("fetchingWikiData");

      loadTimeoutId.value = window.setTimeout(() => {
        if (isLoading.value) {
          logger.warn("getSavedWikis command timed out");
          setError(
            ErrorCodes.savedWikisLoadTimeout,
            "Failed to load saved wikis: Request timed out",
            {
              operation: "loadSavedWikis",
            },
          );
          loading.value = false;
          isLoading.value = false;
          savedWikisLoadingContext.fail("Failed to load saved wikis: Request timed out");
          loadTimeoutId.value = null;
        }
      }, 10000);

      vscode.postMessage({ command: "getSavedWikis" });
    } catch (error) {
      if (loadTimeoutId.value) {
        window.clearTimeout(loadTimeoutId.value);
        loadTimeoutId.value = null;
      }
      setError(
        ErrorCodes.savedWikisLoadFailed,
        "Failed to load saved wikis",
        {
          operation: "loadSavedWikis",
        },
        error,
      );
      loading.value = false;
      isLoading.value = false;
      savedWikisLoadingContext.fail("Failed to load saved wikis");
    }
  };

  const showReadmeDiff = async () => {
    if (!diffAvailable.value || updateReadmeState.value === "loading") {
      return;
    }

    try {
      vscode.postMessage({
        command: "showReadmeDiff",
      });
    } catch (error) {
      logger.error("Failed to open README diff view", error);
      setError(
        ErrorCodes.readmeUpdateFailed,
        "Failed to open README diff view",
        {
          operation: "showReadmeDiff",
        },
        error,
      );
    }
  };

  const preventScroll = (event: Event) => {
    if (isReadmeUpdateLoading.value) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleMessage = (event: MessageEvent) => {
    const message = event.data;

    switch (message.command) {
      case "savedWikisLoaded":
        if (loadTimeoutId.value) {
          window.clearTimeout(loadTimeoutId.value);
          loadTimeoutId.value = null;
        }
        savedWikis.value = message.payload.wikis;
        if (message.payload.readmeStatus) {
          const status = message.payload.readmeStatus;
          isReadmeSynced.value = !!status.isSynced;
          hasBackup.value = !!status.hasBackup;
          diffAvailable.value = !!status.diffAvailable;
          readmeLastUpdatedAt.value =
            typeof status.lastUpdatedAt === "number" ? status.lastUpdatedAt : null;
        } else {
          isReadmeSynced.value = false;
          diffAvailable.value = false;
        }
        savedWikisLoadingContext.advance("sortingWikis");
        savedWikisLoadingContext.advance("renderingWikis");
        loading.value = false;
        isLoading.value = false;
        savedWikisLoadingContext.complete();
        break;
      case "wikiDeleted":
        optimisticDeletes.value.delete(message.payload.wikiId);
        savedWikis.value = savedWikis.value.filter((w) => w.id !== message.payload.wikiId);
        break;
      case "readmeUpdateProgress":
        if (message.payload) {
          updateReadmeState.value = "loading";
        }
        break;
      case "readmeUpdated":
        readmeUpdateLoadingContext.complete();
        if (message.payload.success) {
          updateReadmeState.value = "done";
          window.setTimeout(() => {
            updateReadmeState.value = "idle";
          }, 2000);
          loadSavedWikis();
        } else {
          updateReadmeState.value = "idle";
        }
        undoReadmeState.value = "idle";
        vscode.postMessage({ command: "checkReadmeBackupState" });
        break;
      case "readmeBackupCreated":
        hasBackup.value = true;
        undoReadmeState.value = "idle";
        vscode.postMessage({ command: "checkReadmeBackupState" });
        break;
      case "readmeBackupDeleted":
        hasBackup.value = false;
        undoReadmeState.value = "idle";
        vscode.postMessage({ command: "checkReadmeBackupState" });
        break;
      case "readmeBackupState":
        hasBackup.value = message.payload?.hasBackup ?? false;
        if (message.payload?.readmeStatus) {
          const status = message.payload.readmeStatus;
          isReadmeSynced.value = !!status.isSynced;
          diffAvailable.value = !!status.diffAvailable;
          readmeLastUpdatedAt.value =
            typeof status.lastUpdatedAt === "number" ? status.lastUpdatedAt : null;
        }
        break;
      case "showNotification":
        if (message.payload.type === "error") {
          if (message.payload.message?.includes("delete")) {
            const deletedWikiIds = Array.from(optimisticDeletes.value.keys());
            for (const wikiId of deletedWikiIds) {
              const deletedWiki = optimisticDeletes.value.get(wikiId);
              if (deletedWiki) {
                savedWikis.value.push(deletedWiki);
                optimisticDeletes.value.delete(wikiId);
              }
            }
          }
          if (loadTimeoutId.value) {
            window.clearTimeout(loadTimeoutId.value);
            loadTimeoutId.value = null;
          }
          setError(ErrorCodes.notificationError, message.payload.message, {
            operation: "notificationHandler",
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
      window.clearTimeout(loadTimeoutId.value);
      loadTimeoutId.value = null;
    }
  });

  return {
    searchQuery,
    debouncedSearchQuery,
    savedWikis,
    filteredWikis,
    groupedWikis,
    virtualListItems,
    virtualList: list,
    containerProps,
    wrapperProps,
    previewWiki,
    updateReadmeState,
    undoReadmeState,
    hasBackup,
    isReadmeSynced,
    diffAvailable,
    readmeLastUpdatedAt,
    isSavedWikisLoading,
    isReadmeUpdateLoading,
    readmeUpdateLoadingContext,
    savedWikisLoadingContext,
    scrollableContainer,
    updateReadme,
    undoReadme,
    showReadmeDiff,
    showPreview,
    deleteWiki,
    openWiki,
    loadSavedWikis,
    preventScroll,
  };
}
