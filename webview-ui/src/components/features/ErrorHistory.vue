<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useErrorHistoryStore, type ErrorHistoryEntry } from "@/stores/errorHistory";
import { useLoading } from "@/loading/useLoading";
import Button from "@/components/ui/button.vue";
import { createLogger } from "@/utilities/logging";
import { LoadingViewAnimations } from "@/constants/loadingViewAnimations";

const errorHistory = useErrorHistoryStore();
const showDetails = ref<string[]>([]);
const logger = createLogger("ErrorHistory");
const errorHistoryLoadingContext = useLoading("errorHistory");
const stepDelay = LoadingViewAnimations.minStepDuration;

onMounted(() => {
  if (errorHistoryLoadingContext.state.value.startedAt) {
    if (errorHistoryLoadingContext.isActive.value) {
      errorHistoryLoadingContext.complete();
    }
    return;
  }
  errorHistoryLoadingContext.start("loadingHistory");
  errorHistoryLoadingContext.advance("fetchingErrors");
  setTimeout(() => {
    errorHistoryLoadingContext.advance("renderingHistory");
    setTimeout(() => {
      errorHistoryLoadingContext.complete();
    }, stepDelay);
  }, stepDelay);
});

const sortedErrors = computed(() => {
  return [...errorHistory.errors].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
});

const toggleDetails = (errorId: string) => {
  const index = showDetails.value.indexOf(errorId);
  if (index === -1) {
    showDetails.value.push(errorId);
  } else {
    showDetails.value.splice(index, 1);
  }
};

const copyErrorToClipboard = async (error: ErrorHistoryEntry) => {
  try {
    let errorText = `Error Code: ${error.code || "Unknown"}\n`;
    errorText += `Timestamp: ${new Date(error.timestamp).toLocaleString()}\n`;
    errorText += `Message: ${error.message}\n`;

    if (error.originalError && error.originalError !== error.message) {
      errorText += `Original Error: ${error.originalError}\n`;
    }

    if (error.context) {
      errorText += `Context: ${error.context}\n`;
    }

    if (error.suggestions && error.suggestions.length > 0) {
      errorText += `Suggestions:\n${error.suggestions.map((s) => `- ${s}`).join("\n")}\n`;
    }

    await navigator.clipboard.writeText(errorText);
    logger.debug("Error copied to clipboard");
  } catch (err) {
    logger.error("Failed to copy error text", err);
  }
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
};

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};

const getErrorIcon = (code?: string) => {
  if (!code)
    return "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z";

  if (code.includes("PROVIDER"))
    return "M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v7m3-2h6";
  if (code.includes("API_KEY"))
    return "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z";
  if (code.includes("NETWORK"))
    return "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0";
  if (code.includes("CONFIGURATION"))
    return "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z";
  if (code.includes("RATE_LIMIT")) return "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z";

  return "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z";
};

const getErrorColor = (code?: string) => {
  if (!code) return "text-destructive";

  if (code.includes("PROVIDER")) return "text-orange-500";
  if (code.includes("API_KEY")) return "text-yellow-600";
  if (code.includes("NETWORK")) return "text-blue-500";
  if (code.includes("CONFIGURATION")) return "text-purple-500";
  if (code.includes("RATE_LIMIT")) return "text-amber-600";

  return "text-destructive";
};
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-border border-b px-4 py-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Error History</h2>
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground text-sm">
            {{ errorHistory.getErrorCount() }} errors
          </span>
          <Button
            v-if="errorHistory.errors.length > 0"
            variant="outline"
            size="sm"
            @click="errorHistory.clearErrors()"
          >
            Clear All
          </Button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto p-4">
      <div v-if="errorHistory.errors.length === 0" class="flex h-full items-center justify-center">
        <div class="text-center">
          <div
            class="bg-muted/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full p-4"
          >
            <svg
              class="text-muted-foreground h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 class="mb-2 text-lg font-medium">No errors recorded</h3>
          <p class="text-muted-foreground text-sm">Errors will appear here as they occur</p>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div v-for="error in sortedErrors" :key="error.id" class="bg-card rounded-lg border p-4">
          <div class="mb-2 flex items-start justify-between">
            <div class="flex items-center gap-2">
              <div class="flex h-6 w-6 items-center justify-center">
                <svg
                  :class="getErrorColor(error.code)"
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path :d="getErrorIcon(error.code)" />
                </svg>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span v-if="error.code" class="bg-muted rounded px-2 py-1 font-mono text-xs">
                    {{ error.code }}
                  </span>
                  <span class="text-muted-foreground text-xs">
                    {{ formatDate(error.timestamp) }} at {{ formatTime(error.timestamp) }}
                  </span>
                </div>
                <p class="mt-1 text-sm font-medium">{{ error.message }}</p>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="text-muted-foreground hover:text-foreground p-1"
                title="Copy error details"
                @click="copyErrorToClipboard(error)"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
              </button>
              <button
                v-if="error.id"
                class="text-muted-foreground hover:text-foreground p-1"
                title="Remove error"
                @click="errorHistory.removeError(error.id)"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <button
                v-if="error.id"
                class="text-muted-foreground hover:text-foreground p-1"
                title="Toggle details"
                @click="toggleDetails(error.id)"
              >
                <svg
                  class="h-4 w-4 transition-transform"
                  :class="{ 'rotate-180': error.id && showDetails.includes(error.id) }"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div v-if="error.id && showDetails.includes(error.id)" class="mt-3 space-y-3">
            <div
              v-if="error.originalError && error.originalError !== error.message"
              class="bg-destructive/10 border-destructive/20 rounded border p-3"
            >
              <p class="mb-1 text-xs font-medium">Original Error:</p>
              <p class="break-words font-mono text-xs">{{ error.originalError }}</p>
            </div>

            <div v-if="error.context" class="bg-muted/50 rounded p-3">
              <p class="mb-1 text-xs font-medium">Context:</p>
              <p class="break-words font-mono text-xs">{{ error.context }}</p>
            </div>

            <div v-if="error.suggestions && error.suggestions.length > 0">
              <p class="mb-2 text-xs font-medium">Suggestions:</p>
              <ul class="space-y-1 text-xs">
                <li
                  v-for="(suggestion, index) in error.suggestions"
                  :key="index"
                  class="flex items-start gap-2"
                >
                  <svg
                    class="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{{ suggestion }}</span>
                </li>
              </ul>
            </div>

            <div v-if="error.retryable" class="flex justify-center">
              <Button size="sm" variant="outline">
                <svg class="mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry Operation
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
