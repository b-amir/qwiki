<script setup lang="ts">
interface Props {
  warnings: Array<string | { field?: string; code?: string; message: string }>;
}

defineProps<Props>();
</script>

<template>
  <div
    v-if="warnings.length > 0"
    class="rounded-lg border border-amber-500/30 bg-amber-50/50 p-3 shadow-sm sm:p-4 dark:bg-amber-950/20"
  >
    <div
      class="mb-3 flex items-center gap-2 border-b border-amber-500/20 pb-2 sm:mb-4 sm:gap-2.5 sm:pb-3"
    >
      <svg
        class="h-4 w-4 shrink-0 text-amber-600 sm:h-5 sm:w-5 dark:text-amber-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h4 class="font-semibold text-amber-900 dark:text-amber-100">
        Configuration Warnings ({{ warnings.length }})
      </h4>
    </div>
    <ul class="m-0 list-none space-y-2.5 p-0 sm:space-y-3">
      <li
        v-for="(warning, index) in warnings"
        :key="index"
        class="min-w-0 rounded-lg border border-amber-500/20 bg-amber-50/30 p-2.5 sm:p-3.5 dark:bg-amber-950/10"
      >
        <div class="flex items-start gap-2 sm:gap-3">
          <svg
            class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 sm:h-5 sm:w-5 dark:text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex flex-wrap items-start gap-2">
              <p
                class="break-words text-sm font-medium leading-relaxed text-amber-900 sm:text-[0.9375rem] dark:text-amber-100"
              >
                {{ typeof warning === "string" ? warning : warning.message }}
              </p>
            </div>
            <div
              v-if="typeof warning === 'object' && (warning.field || warning.code)"
              class="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:gap-3"
            >
              <span
                v-if="warning.field"
                class="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs dark:bg-amber-900/30"
              >
                {{ warning.field }}
              </span>
              <span v-if="warning.code" class="text-muted-foreground"
                >Code: {{ warning.code }}</span
              >
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
