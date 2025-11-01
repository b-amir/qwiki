<script setup lang="ts">
import { ref } from "vue";
import { createLogger } from "@/utilities/logging";
import { useErrorCategory } from "@/composables/useErrorCategory";

interface Props {
  error: string;
  errorCode?: string;
  suggestions?: string[];
  retryable?: boolean;
  onRetry?: () => void;
  timestamp?: string;
  context?: string;
  originalError?: string;
}

const props = defineProps<Props>();

const copySuccess = ref(false);
const logger = createLogger("ErrorDisplay");

const { category: errorCategory, icon: errorIcon } = useErrorCategory(props.errorCode);

const copyErrorToClipboard = async () => {
  try {
    let errorText = props.errorCode
      ? `Error Code: ${props.errorCode}\n\n${props.error}`
      : props.error;

    if (props.originalError && props.originalError !== props.error) {
      errorText = `${errorText}\n\nOriginal Error: ${props.originalError}`;
    }

    if (props.timestamp) {
      errorText = `Timestamp: ${props.timestamp}\n\n${errorText}`;
    }

    if (props.context) {
      errorText = `${errorText}\n\nContext: ${props.context}`;
    }

    if (props.suggestions && props.suggestions.length > 0) {
      errorText = `${errorText}\n\nSuggestions:\n${props.suggestions.map((s) => `- ${s}`).join("\n")}`;
    }

    await navigator.clipboard.writeText(errorText);
    copySuccess.value = true;

    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (err) {
    logger.error("Failed to copy error text", err);
  }
};
</script>

<template>
  <div class="flex h-full flex-col px-4 py-6 sm:px-6">
    <div class="flex flex-1 items-center justify-center">
      <div class="w-full max-w-2xl space-y-6">
        <div class="bg-muted/30 rounded-xl border p-6 shadow-sm sm:p-8">
          <!-- Header Section -->
          <div class="mb-6 flex items-start gap-4">
            <div
              :class="{
                'bg-destructive/15': errorCategory === 'general',
                'bg-orange-500/15': errorCategory === 'provider',
                'bg-yellow-500/15': errorCategory === 'authentication',
                'bg-blue-500/15': errorCategory === 'network',
                'bg-purple-500/15': errorCategory === 'configuration',
                'bg-amber-500/15': errorCategory === 'rate-limit',
              }"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12"
            >
              <svg
                :class="{
                  'text-destructive': errorCategory === 'general',
                  'text-orange-600': errorCategory === 'provider',
                  'text-yellow-600': errorCategory === 'authentication',
                  'text-blue-600': errorCategory === 'network',
                  'text-purple-600': errorCategory === 'configuration',
                  'text-amber-600': errorCategory === 'rate-limit',
                }"
                class="h-5 w-5 sm:h-6 sm:w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path :d="errorIcon" />
              </svg>
            </div>
            <div class="flex-1 space-y-2">
              <div>
                <h3 class="text-foreground text-base font-semibold capitalize sm:text-lg">
                  {{ errorCategory.replace("-", " ") }} Error
                </h3>
                <div
                  v-if="errorCode || timestamp"
                  class="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs"
                >
                  <span v-if="errorCode" class="font-mono font-medium">{{ errorCode }}</span>
                  <span v-if="timestamp" class="flex items-center gap-1.5">
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {{ new Date(timestamp).toLocaleString() }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Message Section -->
          <div class="mb-6">
            <div class="bg-background/50 rounded-lg p-4 sm:p-5">
              <p
                class="text-foreground whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base"
              >
                {{ error }}
              </p>
            </div>
          </div>

          <!-- Suggestions Section -->
          <div
            v-if="suggestions && suggestions.length > 0"
            class="mb-6 rounded-lg bg-blue-50/50 p-5 sm:p-6 dark:bg-blue-950/20"
          >
            <div class="mb-3 flex items-center gap-2">
              <svg
                class="h-5 w-5 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <h4 class="text-sm font-semibold text-blue-900 sm:text-base dark:text-blue-100">
                Suggestions
              </h4>
            </div>
            <ul class="space-y-3">
              <li
                v-for="(suggestion, index) in suggestions"
                :key="index"
                class="flex items-start gap-3"
              >
                <svg
                  class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
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
                <span class="text-sm leading-relaxed text-blue-800 sm:text-base dark:text-blue-200">
                  {{ suggestion }}
                </span>
              </li>
            </ul>
          </div>

          <!-- Context Section -->
          <div v-if="context" class="bg-muted/60 mb-6 rounded-lg p-4 sm:p-5">
            <h4
              class="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide sm:text-sm"
            >
              Context
            </h4>
            <div
              class="bg-background/50 break-words rounded border p-3 font-mono text-xs leading-relaxed sm:p-4 sm:text-sm"
            >
              {{ context }}
            </div>
          </div>

          <!-- Original Error Section -->
          <div
            v-if="originalError && originalError !== error"
            class="border-destructive/20 bg-destructive/5 mb-6 rounded-lg border p-4 sm:p-5"
          >
            <h4
              class="text-destructive mb-3 text-xs font-semibold uppercase tracking-wide sm:text-sm"
            >
              Original Error Details
            </h4>
            <div
              class="bg-background/80 border-destructive/10 break-words rounded border p-3 font-mono text-xs leading-relaxed sm:p-4 sm:text-sm"
            >
              {{ originalError }}
            </div>
          </div>

          <!-- Copy Error Button -->
          <div class="border-border/50 mt-6 border-t pt-4">
            <button
              class="bg-secondary hover:bg-secondary/80 text-secondary-foreground focus-visible:ring-ring inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 sm:px-6 sm:py-3.5 sm:text-base"
              @click="copyErrorToClipboard"
            >
              <svg
                v-if="!copySuccess"
                class="h-4 w-4 sm:h-5 sm:w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              <svg
                v-else
                class="h-4 w-4 text-green-600 sm:h-5 sm:w-5"
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
              <span>{{ copySuccess ? "Copied to Clipboard!" : "Copy Error Details" }}</span>
            </button>
          </div>

          <!-- Retry Button -->
          <div v-if="retryable && onRetry" class="mt-3">
            <button
              class="bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:ring-ring inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 sm:px-6 sm:py-3.5 sm:text-base"
              @click="onRetry"
            >
              <svg
                class="h-4 w-4 sm:h-5 sm:w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retry Operation
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="mt-auto pt-4">
      <slot name="actions" />
    </div>
  </div>
</template>
