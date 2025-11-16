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
let lastFrameTime = 0;
let charRemainder = 0;

const BASE_CHARS_PER_SECOND = 180;
const MAX_CHARS_PER_SECOND = 1200;

const wikiContentWithoutTitle = computed(() => {
  const contentToUse = isStreaming.value ? displayedContent.value : wiki.content || "";
  if (contentToUse && typeof contentToUse === "string") {
    return contentToUse.replace(/^#\s+.+$/m, "");
  }
  return contentToUse || "";
});

function isNearBottom(el: HTMLElement, threshold = 80): boolean {
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distanceFromBottom < threshold;
}

function stickToBottom(): void {
  const el = contentRef.value;
  if (!el) return;
  if (!isNearBottom(el)) return;

  el.scrollTop = el.scrollHeight;
}

function stepTyping(timestamp: number): void {
  if (!targetContent.value) {
    typingAnimationId = null;
    lastFrameTime = 0;
    charRemainder = 0;
    return;
  }

  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const dt = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  const remaining = targetContent.value.length - displayedContent.value.length;
  if (remaining <= 0) {
    typingAnimationId = null;
    lastFrameTime = 0;
    charRemainder = 0;
    return;
  }

  let speed = BASE_CHARS_PER_SECOND;
  if (remaining > 1000) {
    speed *= 4;
  } else if (remaining > 300) {
    speed *= 2;
  } else if (remaining < 80) {
    speed *= 0.7;
  }
  speed = Math.min(speed, MAX_CHARS_PER_SECOND);

  const charsFloat = (speed * dt) / 1000 + charRemainder;
  const charsToAdd = Math.max(1, Math.floor(charsFloat));
  charRemainder = charsFloat - charsToAdd;

  const nextLength = Math.min(
    targetContent.value.length,
    displayedContent.value.length + charsToAdd,
  );

  displayedContent.value = targetContent.value.slice(0, nextLength);

  if (contentRef.value && isStreaming.value) {
    stickToBottom();
  }

  typingAnimationId = requestAnimationFrame(stepTyping);
}

function startTypingLoop(): void {
  if (typingAnimationId !== null) return;
  lastFrameTime = 0;
  charRemainder = 0;
  typingAnimationId = requestAnimationFrame(stepTyping);
}

function stopTypingLoop(): void {
  if (typingAnimationId !== null) {
    cancelAnimationFrame(typingAnimationId);
    typingAnimationId = null;
  }
  lastFrameTime = 0;
  charRemainder = 0;
}

watch(
  () => ({
    content: wiki.content,
    streaming: isStreaming.value,
  }),
  ({ content, streaming }, _, onCleanup) => {
    if (!content) {
      stopTypingLoop();
      displayedContent.value = "";
      targetContent.value = "";
      return;
    }

    targetContent.value = content;

    if (streaming) {
      if (!displayedContent.value || displayedContent.value.length > content.length) {
        displayedContent.value = "";
      }
      startTypingLoop();
    } else {
      stopTypingLoop();
      displayedContent.value = content;
    }

    onCleanup(() => {
      stopTypingLoop();
    });
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
  stopTypingLoop();
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
