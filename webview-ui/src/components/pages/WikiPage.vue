<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from "vue";
import LoadingState from "@/components/features/LoadingState.vue";
import MarkdownRenderer from "@/components/MarkdownRenderer.vue";
import Button from "@/components/ui/button.vue";
import { useWikiStore } from "@/stores/wiki";
import { useVscode } from "@/composables/useVscode";
import { useLoading } from "@/loading/useLoading";
import { useDelayedLoadingState } from "@/composables/useDelayedLoadingState";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import { createLogger } from "@/utilities/logging";

const wiki = useWikiStore();
const logger = createLogger("WikiPage");
const vscode = useVscode();
const wikiLoadingContext = useLoading("wiki");
const isSaving = ref(false);
const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const contentRef = ref<HTMLElement | null>(null);
const saveButtonRef = ref<HTMLElement | null>(null);
let messageHandler: ((event: MessageEvent) => void) | null = null;

const isLoadingRaw = computed(() => wiki.loading || wikiLoadingContext.isActive.value);
const { displayLoading: showWikiLoading } = useDelayedLoadingState(
  isLoadingRaw,
  computed(() => wikiLoadingContext.steps.value.length),
  { minDisplayTime: 400, perStepDelay: 100 },
);

const hasContent = computed(() => wiki.content && wiki.content.trim().length > 0);
const isStreaming = computed(() => wiki.loading && hasContent.value);
const showContent = computed(() => hasContent.value);
const showLoadingOverlay = computed(() => showWikiLoading.value && !hasContent.value);

const displayedContent = ref("");
const targetContent = ref("");
let typingAnimationId: number | null = null;
const BASE_CHARS_PER_FRAME = 15;
const MAX_CHARS_PER_FRAME = 100;

const wikiContentWithoutTitle = computed(() => {
  if (isStreaming.value) {
    if (displayedContent.value && typeof displayedContent.value === "string") {
      return displayedContent.value.replace(/^#\s+.+$/m, "");
    }
    return displayedContent.value || "";
  }
  if (wiki.content && typeof wiki.content === "string") {
    return wiki.content.replace(/^#\s+.+$/m, "");
  }
  return wiki.content || "";
});

function typeContent() {
  if (displayedContent.value.length < targetContent.value.length) {
    const remaining = targetContent.value.slice(displayedContent.value.length);
    const gap = targetContent.value.length - displayedContent.value.length;

    let charsToAdd = BASE_CHARS_PER_FRAME;
    if (gap > 500) {
      charsToAdd = MAX_CHARS_PER_FRAME;
    } else if (gap > 200) {
      charsToAdd = Math.floor(gap / 10);
    } else if (gap > 50) {
      charsToAdd = BASE_CHARS_PER_FRAME * 2;
    }

    charsToAdd = Math.min(charsToAdd, remaining.length);
    displayedContent.value = targetContent.value.slice(
      0,
      displayedContent.value.length + charsToAdd,
    );

    if (contentRef.value && isStreaming.value) {
      contentRef.value.scrollTo({
        top: contentRef.value.scrollHeight,
        behavior: "smooth",
      });
    }

    typingAnimationId = requestAnimationFrame(() => {
      typeContent();
    });
  } else {
    typingAnimationId = null;
  }
}

watch(
  () => wiki.content,
  (newContent) => {
    if (isStreaming.value && newContent) {
      targetContent.value = newContent;
      if (!typingAnimationId) {
        typeContent();
      }
    } else if (!isStreaming.value && newContent) {
      displayedContent.value = newContent;
      targetContent.value = newContent;
      if (typingAnimationId) {
        cancelAnimationFrame(typingAnimationId);
        typingAnimationId = null;
      }
    }
  },
  { immediate: true },
);

const wikiTitle = computed(() => {
  if (wiki.content && typeof wiki.content === "string") {
    const match = wiki.content.match(/^#\s+(.+)$/m);
    const title = match ? match[1].trim() : "Untitled Wiki";
    return title.length > 36 ? title.substring(0, 33) + "..." : title;
  }
  return "Untitled Wiki";
});

const saveWiki = async () => {
  if (!wiki.content || isSaving.value) return;

  const originalContent = wiki.content;
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

const handleCancel = () => {
  if (wiki.loading) {
    wiki.cancelPendingActions();
  }
};

useKeyboardShortcuts(
  [
    {
      key: "s",
      ctrl: true,
      handler: (event) => {
        if (hasContent.value && !isSaving.value) {
          event.preventDefault();
          saveWiki();
        }
      },
    },
    {
      key: "Escape",
      handler: () => {
        if (wiki.loading) {
          handleCancel();
        }
      },
    },
  ],
  computed(() => hasContent.value || wiki.loading),
);

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
  if (typingAnimationId) {
    cancelAnimationFrame(typingAnimationId);
    typingAnimationId = null;
  }
});
</script>

<template>
  <div class="flex h-full flex-col" role="main" aria-label="Wiki Content">
    <div class="flex-1 overflow-auto pb-3">
      <div v-if="showLoadingOverlay" class="h-full" role="status" aria-live="polite">
        <LoadingState context="wiki" />
      </div>
      <div v-if="showContent" class="relative">
        <div
          ref="contentRef"
          class="overflow-auto p-4"
          role="article"
          aria-label="Wiki Content"
          tabindex="0"
        >
          <MarkdownRenderer :content="wikiContentWithoutTitle" />
        </div>
      </div>
    </div>

    <div
      v-if="hasContent"
      class="border-border bg-background flex-shrink-0 border-t px-4 py-4"
      role="toolbar"
      aria-label="Wiki Actions"
    >
      <Button
        ref="saveButtonRef"
        :disabled="saveState === 'saving'"
        class="bg-foreground w-full text-sm"
        aria-label="Save Wiki"
        :aria-busy="saveState === 'saving'"
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
        {{
          saveState === "saving"
            ? "Saving..."
            : saveState === "saved"
              ? "Saved"
              : "Save Wiki (Ctrl+S)"
        }}
      </Button>
    </div>
  </div>
</template>
