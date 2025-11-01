<script setup lang="ts">
interface Props {
  isValid: boolean;
  showErrors: boolean;
  errors: Array<string | { field?: string; code?: string; message: string; severity?: string }>;
  warnings: Array<string | { field?: string; code?: string; message: string }>;
}

defineProps<Props>();
</script>

<template>
  <div>
    <div
      v-if="isValid && !showErrors"
      class="rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-4 sm:p-5 dark:bg-emerald-950/20"
    >
      <div class="flex items-center gap-3">
        <svg
          class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
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
        <div>
          <p class="text-sm font-semibold text-emerald-900 sm:text-base dark:text-emerald-100">
            Configuration is valid
          </p>
          <p class="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
            Your provider configuration has been validated successfully.
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="showErrors && (errors.length > 0 || warnings.length > 0)"
      class="space-y-4 sm:space-y-5"
    >
      <div
        v-if="errors.length > 0"
        class="border-destructive/30 bg-destructive/5 rounded-lg border p-5 shadow-sm sm:p-6"
      >
        <div class="mb-4 flex items-center gap-2.5">
          <svg
            class="text-destructive h-5 w-5 shrink-0"
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
          <h4 class="text-destructive text-sm font-semibold sm:text-base">
            Configuration Errors ({{ errors.length }})
          </h4>
        </div>
        <ul class="space-y-3 sm:space-y-4">
          <li
            v-for="(error, index) in errors"
            :key="index"
            class="border-destructive/20 bg-destructive/5 rounded-lg border p-3.5 sm:p-4"
          >
            <div class="flex items-start gap-3">
              <svg
                class="text-destructive mt-0.5 h-5 w-5 shrink-0"
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
              <div class="flex-1 space-y-1.5">
                <div class="flex flex-wrap items-start gap-2">
                  <p class="text-destructive text-sm font-medium leading-relaxed sm:text-base">
                    {{ typeof error === "string" ? error : error.message }}
                  </p>
                </div>
                <div
                  v-if="typeof error === 'object' && (error.field || error.code)"
                  class="text-muted-foreground flex flex-wrap items-center gap-3 text-xs"
                >
                  <span
                    v-if="error.field"
                    class="bg-background/60 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium"
                  >
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    Field: {{ error.field }}
                  </span>
                  <span
                    v-if="error.code"
                    class="bg-background/60 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono font-medium"
                  >
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                      />
                    </svg>
                    {{ error.code }}
                  </span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <div
        v-if="warnings.length > 0"
        class="rounded-lg border border-amber-500/30 bg-amber-50/50 p-5 shadow-sm sm:p-6 dark:bg-amber-950/20"
      >
        <div class="mb-4 flex items-center gap-2.5">
          <svg
            class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
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
          <h4 class="text-sm font-semibold text-amber-900 sm:text-base dark:text-amber-100">
            Configuration Warnings ({{ warnings.length }})
          </h4>
        </div>
        <ul class="space-y-3 sm:space-y-4">
          <li
            v-for="(warning, index) in warnings"
            :key="index"
            class="rounded-lg border border-amber-500/20 bg-amber-50/30 p-3.5 sm:p-4 dark:bg-amber-950/10"
          >
            <div class="flex items-start gap-3">
              <svg
                class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
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
              <div class="flex-1 space-y-1.5">
                <p
                  class="text-sm font-medium leading-relaxed text-amber-900 sm:text-base dark:text-amber-100"
                >
                  {{ typeof warning === "string" ? warning : warning.message }}
                </p>
                <div
                  v-if="typeof warning === 'object' && (warning.field || warning.code)"
                  class="flex flex-wrap items-center gap-3 text-xs text-amber-700 dark:text-amber-300"
                >
                  <span
                    v-if="warning.field"
                    class="bg-background/60 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium"
                  >
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    Field: {{ warning.field }}
                  </span>
                  <span
                    v-if="warning.code"
                    class="bg-background/60 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono font-medium"
                  >
                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                      />
                    </svg>
                    {{ warning.code }}
                  </span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
