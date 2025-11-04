<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import ErrorModal from "@/components/features/ErrorModal.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import Button from "@/components/ui/button.vue";
import { useWikiStore } from "@/stores/wiki";
import { useVscode } from "@/composables/useVscode";
import { useLoading } from "@/loading/useLoading";
import { createLogger } from "@/utilities/logging";

const wiki = useWikiStore();
const logger = createLogger("WikiPage");
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
    const title = match ? match[1].trim() : "Untitled Wiki";
    return title.length > 36 ? title.substring(0, 33) + "..." : title;
  }
  return "Untitled Wiki";
});

const errorModalOpen = computed({
  get: () => !!wiki.error,
  set: (value: boolean) => {
    if (!value) {
      wiki.error = "";
      wiki.errorInfo = null;
    }
  },
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
      <div v-else-if="wiki.content" class="relative">
        <div class="overflow-auto p-4">
          <MarkdownRenderer :content="wikiContentWithoutTitle" />
        </div>
      </div>
    </div>

    <div v-if="wiki.content" class="border-border bg-background flex-shrink-0 border-t px-4 py-4">
      <Button
        :disabled="saveState === 'saving'"
        class="bg-foreground w-full text-sm"
        @click="saveWiki"
      >
        <svg
          v-if="saveState === 'saving'"
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
          v-else-if="saveState === 'saved'"
          class="mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {{ saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save Wiki" }}
      </Button>
    </div>

    <ErrorModal
      v-if="wiki.error"
      v-model="errorModalOpen"
      :error="wiki.error"
      :error-code="wiki.errorInfo?.code"
      :suggestions="wiki.errorInfo?.suggestions"
      :retryable="wiki.errorInfo?.retryable"
      :on-retry="wiki.retryGeneration"
      :timestamp="wiki.errorInfo?.timestamp"
      :context="wiki.errorInfo?.context"
      :original-error="wiki.errorInfo?.originalError"
      @close="
        () => {
          errorModalOpen = false;
        }
      "
    />
  </div>
</template>
