<template>
  <div
    ref="rowRef"
    :class="[
      'flex min-h-[28px] items-center gap-1.5 transition-[gap,opacity] duration-[180ms] ease-out',
      state === 'completed' && 'gap-1 opacity-85 sm:gap-1.5',
      state === 'completed' && completedDepth === 1 && 'opacity-85 blur-[0.2px]',
      state === 'completed' && completedDepth === 2 && 'opacity-70 blur-[0.5px]',
      state === 'completed' && completedDepth === 3 && 'opacity-55 blur-[0.8px]',
      state === 'active' && 'gap-2 sm:gap-2.5',
      state === 'pending' && 'gap-1.5 sm:gap-2',
      state === 'pending' && pendingDepth === 1 && 'opacity-85 blur-[0.2px]',
      state === 'pending' && pendingDepth === 2 && 'opacity-70 blur-[0.5px]',
      state === 'pending' && pendingDepth === 3 && 'opacity-55 blur-[0.8px]',
    ]"
  >
    <div
      :class="[
        'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center transition-colors duration-200 ease-out sm:h-5 sm:w-5',
        state === 'active' && 'text-primary animate-[iconPulse_1.2s_ease-in-out_infinite]',
        state === 'completed' && 'text-muted-foreground',
        state === 'pending' && 'text-transparent',
      ]"
    >
      <StepSpinner v-if="state === 'active'" />
    </div>

    <div class="min-w-0 flex-1 overflow-hidden">
      <span
        v-if="state !== 'pending'"
        :class="[
          'inline-block w-full overflow-hidden text-ellipsis whitespace-nowrap transition-colors',
          state === 'completed'
            ? 'text-muted-foreground text-[0.6875rem] font-medium leading-4 tracking-[-0.005em] sm:text-xs'
            : 'text-foreground animate-[textPulse_1.4s_ease-in-out_infinite] text-[0.8125rem] font-semibold leading-4 sm:text-sm',
        ]"
      >
        {{ text }}
      </span>
      <NextStepSkeleton v-else :style="skeletonStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import StepSpinner from "./StepSpinner.vue";
import NextStepSkeleton from "./NextStepSkeleton.vue";

type StepState = "completed" | "active" | "pending";

defineProps<{
  text: string;
  state: StepState;
  isCenter?: boolean;
  completedDepth?: number;
  pendingDepth?: number;
  skeletonStyle?: Record<string, string>;
}>();

const rowRef = ref<HTMLElement | null>(null);

defineExpose({
  rowRef,
});
</script>

<style scoped>
@keyframes iconPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes textPulse {
  0% {
    opacity: 0.9;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.9;
  }
}
</style>
