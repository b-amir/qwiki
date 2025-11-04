<script setup lang="ts">
import ValidationErrorList from "./ValidationErrorList.vue";
import ValidationWarningList from "./ValidationWarningList.vue";

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
      class="rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-3 sm:p-4 dark:bg-emerald-950/20"
    >
      <div class="flex items-start gap-2 sm:items-center sm:gap-3">
        <svg
          class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 sm:mt-0 sm:h-5 sm:w-5 dark:text-emerald-400"
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
        <div class="min-w-0 flex-1">
          <p
            class="break-words text-sm font-semibold leading-snug text-emerald-900 sm:text-[0.875rem] dark:text-emerald-100"
          >
            Configuration is valid
          </p>
          <p
            class="mt-0.5 break-words text-xs leading-normal text-emerald-700 sm:text-xs dark:text-emerald-300"
          >
            Your provider configuration has been validated successfully.
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="showErrors && (errors.length > 0 || warnings.length > 0)"
      class="min-w-0 space-y-3 sm:space-y-4"
    >
      <ValidationErrorList :errors="errors" />
      <ValidationWarningList :warnings="warnings" />
    </div>
  </div>
</template>
