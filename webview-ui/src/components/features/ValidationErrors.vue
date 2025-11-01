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
      class="validation-success rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
    >
      <div class="flex items-start gap-2 sm:items-center sm:gap-3">
        <svg
          class="validation-icon h-4 w-4 shrink-0 text-emerald-600 sm:h-5 sm:w-5 dark:text-emerald-400"
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
          <p class="validation-title text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            Configuration is valid
          </p>
          <p class="validation-description mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
            Your provider configuration has been validated successfully.
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="showErrors && (errors.length > 0 || warnings.length > 0)"
      class="validation-errors-container space-y-3 sm:space-y-4"
    >
      <ValidationErrorList :errors="errors" />
      <ValidationWarningList :warnings="warnings" />
    </div>
  </div>
</template>

<style scoped>
.validation-success {
  padding: clamp(0.75rem, 2vw, 1rem);
}

.validation-icon {
  margin-top: 0.125rem;
}

@media (min-width: 640px) {
  .validation-icon {
    margin-top: 0;
  }
}

.validation-title {
  font-size: clamp(0.8125rem, 2.5vw, 0.875rem);
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.validation-description {
  font-size: clamp(0.6875rem, 2vw, 0.75rem);
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.validation-errors-container {
  min-width: 0;
}
</style>
