<script setup lang="ts">
interface Props {
  warnings: Array<string | { field?: string; code?: string; message: string }>;
}

defineProps<Props>();
</script>

<template>
  <div
    v-if="warnings.length > 0"
    class="validation-warnings-box rounded-lg border border-amber-500/30 bg-amber-50/50 shadow-sm dark:bg-amber-950/20"
  >
    <div class="validation-warnings-header mb-3 flex items-center gap-2 sm:mb-4 sm:gap-2.5">
      <svg
        class="validation-warnings-icon h-4 w-4 shrink-0 text-amber-600 sm:h-5 sm:w-5 dark:text-amber-500"
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
      <h4 class="validation-warnings-title font-semibold text-amber-900 dark:text-amber-100">
        Configuration Warnings ({{ warnings.length }})
      </h4>
    </div>
    <ul class="validation-warnings-list space-y-2.5 sm:space-y-3">
      <li
        v-for="(warning, index) in warnings"
        :key="index"
        class="validation-warning-item rounded-lg border border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10"
      >
        <div class="flex items-start gap-2 sm:gap-3">
          <svg
            class="validation-warning-icon mt-0.5 h-4 w-4 shrink-0 text-amber-600 sm:h-5 sm:w-5 dark:text-amber-500"
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
                class="validation-warning-message font-medium leading-relaxed text-amber-900 dark:text-amber-100"
              >
                {{ typeof warning === "string" ? warning : warning.message }}
              </p>
            </div>
            <div
              v-if="typeof warning === 'object' && (warning.field || warning.code)"
              class="validation-warning-meta text-muted-foreground flex flex-wrap items-center gap-2 text-xs sm:gap-3"
            >
              <span
                v-if="warning.field"
                class="validation-warning-field rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs dark:bg-amber-900/30"
              >
                {{ warning.field }}
              </span>
              <span v-if="warning.code" class="validation-warning-code"
                >Code: {{ warning.code }}</span
              >
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.validation-warnings-box {
  padding: clamp(0.75rem, 2vw, 1rem);
}

.validation-warnings-header {
  padding-bottom: clamp(0.5rem, 1.5vw, 0.75rem);
  border-bottom: 1px solid var(--border-amber, rgba(245, 158, 11, 0.2));
}

.validation-warnings-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.validation-warning-item {
  padding: clamp(0.625rem, 1.75vw, 0.875rem);
}

.validation-warning-message {
  font-size: clamp(0.8125rem, 2.1vw, 0.9375rem);
}

.validation-warning-meta {
  min-width: 0;
}

.validation-warning-badge {
  font-size: clamp(0.625rem, 1.75vw, 0.75rem);
  max-width: 100%;
  min-width: 0;
}
</style>
