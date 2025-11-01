<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorDisplay from "@/components/features/ErrorDisplay.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import RelatedFiles from "@/components/features/RelatedFiles.vue";
import ProjectFiles from "@/components/features/ProjectFiles.vue";
import { useWikiStore } from "@/stores/wiki";
import { useNavigationStatusStore } from "@/stores/navigationStatus";
import { useNavigation } from "@/composables/useNavigation";
import { useVscode } from "@/composables/useVscode";
import { useLoading } from "@/loading/useLoading";
import { createLogger } from "@/utilities/logging";

const wiki = useWikiStore();
const logger = createLogger("WikiPage");
const navigationStatus = useNavigationStatusStore();
const { setPage } = useNavigation();
const vscode = useVscode();
const wikiLoadingContext = useLoading("wiki");
const isSaving = ref(false);
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
let messageHandler: ((event: MessageEvent) => void) | null = null;

const showWikiLoading = computed(() => wiki.loading || wikiLoadingContext.isActive.value);

const wikiContentWithoutTitle = computed(() => {
  if (wiki.content && typeof wiki.content === "string") {
    return wiki.content.replace(/^#\s+.+$/m, "");
  }
  return wiki.content || "";
});

const wikiTitle = computed(() => {
  if (wiki.content && typeof wiki.content === "string") {
    const match = wiki.content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : "Untitled Wiki";
  }
  return "Untitled Wiki";
});

const saveWiki = async () => {
  if (!wiki.content || isSaving.value) return;

  logger.debug("Starting to save wiki", {
    title: wikiTitle.value,
    hasContent: !!wiki.content,
  });
  isSaving.value = true;
  saveState.value = "saving";
  try {
    await vscode.postMessage({
      command: "saveWiki",
      payload: {
        title: wikiTitle.value,
        content: wiki.content,
        sourceFilePath: wiki.filePath,
      },
    });
    logger.debug("Save wiki command sent successfully");
  } catch (error) {
    logger.error("Failed to save wiki", error);
    isSaving.value = false;
    saveState.value = "error";
    setTimeout(() => (saveState.value = "idle"), 2000);
  }
};

onMounted(() => {
  messageHandler = (event: MessageEvent) => {
    const message = event.data || {};
    if (!message || !message.command) return;
    if (message.command === "wikiSaved") {
      isSaving.value = false;
      saveState.value = "saved";
      setTimeout(() => {
        saveState.value = "idle";
      }, 2000);
    } else if (message.command === "showNotification" && message.payload?.type === "error") {
      isSaving.value = false;
      saveState.value = "error";
      setTimeout(() => (saveState.value = "idle"), 2000);
    }
  };
  window.addEventListener("message", messageHandler);

  navigationStatus.finish("wiki");
});

onBeforeUnmount(() => {
  if (messageHandler) {
    window.removeEventListener("message", messageHandler);
    messageHandler = null;
  }
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 overflow-auto pb-3">
      <div v-if="showWikiLoading" class="h-full">
        <LoadingState context="wiki" />
      </div>
      <ErrorDisplay
        v-else-if="wiki.error"
        :error="wiki.error"
        :error-code="wiki.errorInfo?.code"
        :suggestions="wiki.errorInfo?.suggestions"
        :retryable="wiki.errorInfo?.retryable"
        :on-retry="wiki.retryGeneration"
        :timestamp="wiki.errorInfo?.timestamp"
        :context="wiki.errorInfo?.context"
        :original-error="wiki.errorInfo?.originalError"
      >
        <template #actions>
          <div class="flex justify-center gap-4 pt-6">
            <button
              class="text-muted-foreground hover:text-muted-foreground/80 text-sm"
              @click="setPage('settings')"
            >
              Change model
            </button>
            <button
              v-if="wiki.errorInfo?.retryable"
              class="text-primary hover:text-primary/80 text-sm"
              @click="wiki.retryGeneration"
            >
              Retry
            </button>
          </div>
        </template>
      </ErrorDisplay>
      <div v-else-if="wiki.content" class="relative">
        <div class="bg-background border-border sticky top-0 z-10 border-b p-3">
          <div class="flex justify-end">
            <button
              class="bg-vscode-button-background hover:bg-vscode-button-background-hover text-vscode-button-foreground border-vscode-button-border flex items-center gap-2 rounded border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isSaving"
              @click="saveWiki"
            >
              <svg
                v-if="saveState === 'saving'"
                class="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
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
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <svg
                v-else-if="saveState === 'saved'"
                class="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <svg
                v-else
                class="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2"
                />
              </svg>
              {{
                saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save Wiki"
              }}
            </button>
          </div>
        </div>
        <div class="overflow-auto p-4">
          <MarkdownRenderer :content="wikiContentWithoutTitle" />
        </div>
      </div>

      <div
        v-if="wiki.related.length || wiki.filesSample.length"
        class="border-border space-y-4 border-t pt-4"
      >
        <RelatedFiles />
        <ProjectFiles />
      </div>
    </div>
  </div>
</template>
