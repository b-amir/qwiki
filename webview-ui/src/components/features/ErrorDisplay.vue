<script setup lang="ts">
import { ref, computed } from "vue";

interface Props {
  error: string;
  errorCode?: string;
  suggestions?: string[];
  retryable?: boolean;
  onRetry?: () => void;
  timestamp?: string;
  context?: string;
}

const props = defineProps<Props>();

const copySuccess = ref(false);

const errorCategory = computed(() => {
  if (!props.errorCode) return "general";

  if (props.errorCode.includes("PROVIDER")) return "provider";
  if (props.errorCode.includes("API_KEY")) return "authentication";
  if (props.errorCode.includes("NETWORK")) return "network";
  if (props.errorCode.includes("CONFIGURATION")) return "configuration";
  if (props.errorCode.includes("RATE_LIMIT")) return "rate-limit";

  return "general";
});

const errorIcon = computed(() => {
  switch (errorCategory.value) {
    case "provider":
      return "M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v7m3-2h6";
    case "authentication":
      return "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z";
    case "network":
      return "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0";
    case "configuration":
      return "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z";
    case "rate-limit":
      return "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z";
    default:
      return "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z";
  }
});

const copyErrorToClipboard = async () => {
  try {
    let errorText = props.errorCode
      ? `Error Code: ${props.errorCode}\n\n${props.error}`
      : props.error;
    
    if (props.timestamp) {
      errorText = `Timestamp: ${props.timestamp}\n\n${errorText}`;
    }
    
    if (props.context) {
      errorText = `${errorText}\n\nContext: ${props.context}`;
    }

    await navigator.clipboard.writeText(errorText);
    copySuccess.value = true;

    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (err) {
    console.error("[QWIKI]", "Failed to copy error text:", err);
  }
};
</script>

<template>
  <div class="flex h-full flex-col px-2 pl-3">
    <div class="flex flex-1 items-center justify-center">
      <div class="w-full max-w-md space-y-4">
        <div class="text-center">
          <div class="bg-muted/30 rounded-md border p-3">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  :class="{
                    'bg-destructive/10': errorCategory === 'general',
                    'bg-orange-500/10': errorCategory === 'provider',
                    'bg-yellow-500/10': errorCategory === 'authentication',
                    'bg-blue-500/10': errorCategory === 'network',
                    'bg-purple-500/10': errorCategory === 'configuration',
                    'bg-amber-500/10': errorCategory === 'rate-limit',
                  }"
                  class="flex h-6 w-6 items-center justify-center rounded-full"
                >
                  <svg
                    :class="{
                      'text-destructive': errorCategory === 'general',
                      'text-orange-500': errorCategory === 'provider',
                      'text-yellow-600': errorCategory === 'authentication',
                      'text-blue-500': errorCategory === 'network',
                      'text-purple-500': errorCategory === 'configuration',
                      'text-amber-600': errorCategory === 'rate-limit',
                    }"
                    class="h-4 w-4"
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
                <div class="flex flex-col items-start">
                  <span class="text-muted-foreground text-xs font-medium capitalize">
                    {{ errorCategory.replace("-", " ") }} Error
                  </span>
                  <span v-if="errorCode" class="text-muted-foreground text-xs">
                    {{ errorCode }}
                  </span>
                  <span v-if="timestamp" class="text-muted-foreground text-xs ml-2">
                    {{ new Date(timestamp).toLocaleTimeString() }}
                  </span>
                </div>
              </div>
              <a
                class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-transparent text-sm font-medium transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
                :title="copySuccess ? 'Copied!' : 'Copy error message'"
                @click="copyErrorToClipboard"
              >
                <svg
                  v-if="!copySuccess"
                  class="h-4 w-4"
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
                  class="h-4 w-4 text-green-600"
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
              </a>
            </div>
            <div class="max-h-40 overflow-y-auto text-left">
              <p class="text-muted-foreground whitespace-pre-wrap break-words text-sm">
                {{ error }}
              </p>
            </div>

            <div v-if="suggestions && suggestions.length > 0" class="mt-3 text-left">
              <p class="text-muted-foreground mb-2 text-xs font-medium">Suggestions:</p>
              <ul class="text-muted-foreground space-y-1 text-xs">
                <li
                  v-for="(suggestion, index) in suggestions"
                  :key="index"
                  class="flex items-start gap-2"
                >
                  <svg
                    class="mt-0.5 h-3 w-3 flex-shrink-0"
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

            <div v-if="context" class="mt-3 text-left">
              <p class="text-muted-foreground mb-2 text-xs font-medium">Context:</p>
              <div class="bg-muted/50 rounded p-2 text-xs font-mono break-words">
                {{ context }}
              </div>
            </div>

            <div v-if="retryable && onRetry" class="mt-3 flex justify-center">
              <button
                class="bg-primary hover:bg-primary/90 text-primary-foreground inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                @click="onRetry"
              >
                <svg class="mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="mt-auto">
      <slot name="actions" />
    </div>
  </div>
</template>
