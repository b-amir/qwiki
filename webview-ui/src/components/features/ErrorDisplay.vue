<script setup lang="ts">
import { ref } from "vue";

interface Props {
  error: string;
}

const props = defineProps<Props>();

const copySuccess = ref(false);

// Function to copy error message to clipboard
const copyErrorToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.error);
    copySuccess.value = true;
    // Reset the success indicator after 2 seconds
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy error text:", err);
  }
};
</script>

<template>
  <div class="flex h-full flex-col px-2 pl-3">
    <div class="flex flex-1 items-center justify-center">
      <div class="w-full max-w-md space-y-4">
        <!-- Error message -->
        <div class="text-center">
          <div class="bg-muted/30 rounded-md border p-3">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div
                  class="bg-destructive/10 flex h-6 w-6 items-center justify-center rounded-full"
                >
                  <svg
                    class="text-destructive h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <span class="text-muted-foreground text-xs font-medium">Error</span>
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
          </div>
        </div>
      </div>
    </div>
    <!-- Slot for additional content like action buttons -->
    <div class="mt-auto">
      <slot name="actions" />
    </div>
  </div>
</template>
