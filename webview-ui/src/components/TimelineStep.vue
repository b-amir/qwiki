<template>
  <div
    :class="[
      'timeline-step-container relative flex items-center gap-3 pb-4 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] sm:gap-3.5 sm:pb-5',
    ]"
    :style="containerStyle"
  >
    <div class="timeline-node-wrapper relative flex flex-col items-center">
      <div
        :class="[
          'timeline-node relative z-10 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          state === 'active' && 'scale-110 sm:scale-125',
          state === 'completed' && 'animate-pulse-subtle scale-100 opacity-70',
          state === 'pending' && 'animate-pulse-subtle scale-100 opacity-70',
        ]"
        :style="nodeStyle"
      >
        <StepSpinner v-if="state === 'active'" class="timeline-spinner" />
        <svg
          v-else-if="state === 'completed'"
          :width="nodeSize"
          :height="nodeSize"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          class="transition-all duration-500"
        >
          <DotShape fill="currentColor" x="7" y="7" class="text-muted-foreground" />
        </svg>
        <svg
          v-else
          :width="nodeSize"
          :height="nodeSize"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          class="transition-all duration-500"
        >
          <DotShape fill="currentColor" x="7" y="7" class="text-muted-foreground" />
        </svg>
      </div>

      <div
        v-if="!isLast"
        class="timeline-connector bg-muted-foreground absolute left-1/2 top-[16px] h-full w-[2px] -translate-x-1/2 rounded-full transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        :style="connectorStyle"
      ></div>
    </div>

    <div
      :class="[
        'timeline-content flex-1 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        state === 'active' && 'translate-x-0 opacity-100',
        state === 'completed' && 'animate-pulse-subtle translate-x-0 opacity-70',
        state === 'pending' && 'animate-pulse-subtle translate-x-0 opacity-70',
      ]"
    >
      <div
        :class="[
          'timeline-text break-words transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          state === 'active' &&
            'text-foreground text-sm font-semibold leading-snug sm:text-base sm:leading-normal',
          state === 'completed' &&
            'text-muted-foreground text-[0.6875rem] font-medium leading-tight sm:text-xs',
          state === 'pending' &&
            'text-muted-foreground text-[0.6875rem] font-medium leading-tight sm:text-xs',
        ]"
      >
        {{ text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import DotShape from "./DotShape.vue";
import StepSpinner from "./StepSpinner.vue";

type StepState = "completed" | "active" | "pending";

const props = withDefaults(
  defineProps<{
    text: string;
    state: StepState;
    isLast?: boolean;
    distanceFromActive?: number;
  }>(),
  {
    isLast: false,
    distanceFromActive: 0,
  },
);

const nodeSize = computed(() => 14);

const containerStyle = computed(() => {
  const style: Record<string, string> = {};
  const distance = Math.abs(props.distanceFromActive);
  if (distance > 2) {
    const blurAmount = Math.min((distance - 2) * 0.3, 1.5);
    const opacityReduction = Math.max(1 - (distance - 2) * 0.15, 0.3);
    style.filter = `blur(${blurAmount}px)`;
    style.opacity = opacityReduction.toString();
  }
  return style;
});

const nodeStyle = computed(() => {
  const baseStyle: Record<string, string> = {};
  if (props.state === "active") {
    baseStyle.filter = "drop-shadow(0 0 10px rgba(139, 92, 246, 0.5))";
  }
  return baseStyle;
});

const connectorStyle = computed(() => {
  const style: Record<string, string> = {};
  style.opacity = "0.07";
  const distance = Math.abs(props.distanceFromActive);
  if (distance > 2) {
    const blurAmount = Math.min((distance - 2) * 0.3, 1.5);
    style.filter = `blur(${blurAmount}px)`;
  }
  return style;
});
</script>

<style scoped>
@keyframes pulse-subtle {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(0.98);
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.timeline-step-container {
  will-change: gap, padding-bottom;
  contain: layout style;
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}

.timeline-node {
  will-change: transform, filter, opacity;
  transform-origin: center;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.timeline-spinner {
  transform: scale(0.58);
  display: block;
}

.timeline-connector {
  will-change: background, opacity;
  transform: translateZ(0);
}

.timeline-content {
  will-change: transform, opacity;
  min-width: 0;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.timeline-text {
  will-change: font-size, opacity;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

@media (max-width: 280px) {
  .timeline-step-container {
    gap: 0.5rem !important;
    padding-bottom: 0.75rem !important;
  }

  .timeline-node {
    transform: scale(0.85) translateZ(0);
  }

  .timeline-text {
    font-size: 0.625rem !important;
    line-height: 1.2 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-step-container,
  .timeline-node,
  .timeline-connector,
  .timeline-content,
  .timeline-text {
    transition: none !important;
    animation: none !important;
  }

  .timeline-node {
    transform: scale(1) translateZ(0) !important;
  }

  .animate-pulse-subtle {
    animation: none !important;
  }
}
</style>
