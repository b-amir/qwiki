<script setup lang="ts">
interface Props {
  errors: Array<string | { field?: string; code?: string; message: string; severity?: string }>;
}

defineProps<Props>();
</script>

<template>
  <div
    v-if="errors.length > 0"
    class="border-destructive/30 bg-destructive/5 rounded-lg border p-3 shadow-sm sm:p-4"
  >
    <div
      class="border-destructive/20 mb-3 flex items-center gap-2 border-b pb-2 sm:mb-4 sm:gap-2.5 sm:pb-3"
    >
      <svg
        class="text-destructive h-4 w-4 shrink-0 sm:h-5 sm:w-5"
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
      <h4 class="text-destructive font-semibold">Configuration Errors ({{ errors.length }})</h4>
    </div>
    <ul class="m-0 list-none space-y-2.5 p-0 sm:space-y-3">
      <li
        v-for="(error, index) in errors"
        :key="index"
        class="border-destructive/20 bg-destructive/5 rounded-lg border p-2.5 sm:p-3.5"
      >
        <div class="flex items-start gap-2 sm:gap-3">
          <svg
            class="text-destructive mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="flex flex-wrap items-start gap-2">
              <p
                class="text-destructive break-words text-sm font-medium leading-relaxed sm:text-[0.9375rem]"
              >
                {{ typeof error === "string" ? error : error.message }}
              </p>
            </div>
            <div
              v-if="typeof error === 'object' && (error.field || error.code)"
              class="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:gap-3"
            >
              <span
                v-if="error.field"
                class="bg-destructive/10 rounded-md px-2 py-0.5 font-mono text-xs"
              >
                {{ error.field }}
              </span>
              <span v-if="error.code" class="text-muted-foreground">Code: {{ error.code }}</span>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
