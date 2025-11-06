<template>
  <div
    ref="rowRef"
    :class="[
      'step-row flex min-h-[28px] items-center transition-opacity duration-[180ms] ease-out',
      state === 'completed' && 'opacity-85',
      state === 'completed' && completedDepth === 1 && 'blur-[0.2px]',
      state === 'completed' && completedDepth === 2 && 'opacity-70 blur-[0.5px]',
      state === 'completed' && completedDepth === 3 && 'opacity-55 blur-[0.8px]',
      state === 'pending' && pendingDepth === 1 && 'opacity-85 blur-[0.2px]',
      state === 'pending' && pendingDepth === 2 && 'opacity-70 blur-[0.5px]',
      state === 'pending' && pendingDepth === 3 && 'opacity-55 blur-[0.8px]',
      gapClasses,
    ]"
  >
    <div
      :class="[
        'step-row-icon inline-flex h-4 w-4 flex-shrink-0 items-center justify-center transition-colors duration-200 ease-out sm:h-5 sm:w-5',
        state === 'active' && 'text-primary',
        state === 'completed' && 'text-muted-foreground',
        state === 'pending' && 'text-transparent',
      ]"
    >
      <StepSpinner v-if="state === 'active'" />
    </div>

    <div class="step-row-content min-w-0 flex-1 overflow-hidden">
      <span
        v-if="state !== 'pending'"
        :class="[
          'step-row-text inline-block w-full overflow-hidden text-ellipsis whitespace-nowrap transition-colors',
          state === 'completed'
            ? 'text-muted-foreground text-[0.6875rem] font-medium leading-4 tracking-[-0.005em] sm:text-xs'
            : 'text-foreground text-[0.8125rem] font-semibold leading-4 sm:text-sm',
        ]"
      >
        {{ text }}
      </span>
      <NextStepSkeleton v-else :style="skeletonStyle" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import StepSpinner from "./StepSpinner.vue";
import NextStepSkeleton from "./NextStepSkeleton.vue";
import { useGPULayer } from "@/composables/useAnimationOptimization";

type StepState = "completed" | "active" | "pending";

const props = defineProps<{
  text: string;
  state: StepState;
  isCenter?: boolean;
  completedDepth?: number;
  pendingDepth?: number;
  skeletonStyle?: Record<string, string>;
}>();

const rowRef = ref<HTMLElement | null>(null);

const { promoteToGPULayer } = useGPULayer(rowRef);

onMounted(() => {
  promoteToGPULayer();
});

const gapClasses = computed(() => {
  if (props.state === "completed") return "gap-1 sm:gap-1.5";
  if (props.state === "active") return "gap-2 sm:gap-2.5";
  return "gap-1.5 sm:gap-2";
});

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

.step-row {
  will-change: opacity;
  contain: layout style paint;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.step-row-icon {
  will-change: transform, color;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.step-row-icon[class*="active"] {
  animation: iconPulse 1.2s ease-in-out infinite;
}

.step-row-content {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.step-row-text[class*="active"] {
  animation: textPulse 1.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .step-row,
  .step-row-icon,
  .step-row-content,
  .step-row-text {
    transition: none !important;
    animation: none !important;
  }
}
</style>
