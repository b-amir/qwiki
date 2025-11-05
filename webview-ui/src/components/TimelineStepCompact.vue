<template>
  <div
    class="timeline-step-compact relative flex items-center gap-2 py-2 transition-all duration-500 ease-out"
    :style="containerStyle"
  >
    <div class="timeline-node-wrapper relative flex flex-col items-center">
      <div
        :class="[
          'timeline-node relative z-10 flex items-center justify-center transition-all duration-500 ease-out',
          state === 'active' && 'scale-110',
          state === 'completed' && 'animate-pulse-subtle scale-100 opacity-65',
          state === 'pending' && 'animate-pulse-subtle scale-100 opacity-65',
        ]"
        :style="nodeStyle"
      >
        <StepSpinner v-if="state === 'active'" class="timeline-spinner-compact" />
        <svg
          v-else-if="state === 'completed'"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          class="transition-all duration-500"
        >
          <DotShape fill="currentColor" x="7" y="7" class="text-muted-foreground" />
        </svg>
        <svg
          v-else
          width="12"
          height="12"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          class="transition-all duration-500"
        >
          <DotShape fill="currentColor" x="7" y="7" class="text-muted-foreground" />
        </svg>
      </div>

      <div
        v-if="!isLast"
        class="timeline-connector bg-muted-foreground absolute left-1/2 top-[14px] h-full w-[1.5px] -translate-x-1/2 rounded-full transition-all duration-700 ease-out"
        :style="connectorStyle"
      ></div>
    </div>

    <div
      :class="[
        'timeline-content flex-1 transition-all duration-500 ease-out',
        state === 'active' && 'opacity-100',
        state === 'completed' && 'animate-pulse-subtle opacity-65',
        state === 'pending' && 'animate-pulse-subtle opacity-65',
      ]"
    >
      <div
        :class="[
          'timeline-text break-words transition-all duration-500 ease-out',
          state === 'active' && 'text-foreground text-xs font-semibold leading-snug',
          state === 'completed' &&
            'text-muted-foreground text-[0.625rem] font-medium leading-tight',
          state === 'pending' && 'text-muted-foreground text-[0.625rem] font-medium leading-tight',
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

const nodeStyle = computed(() => {
  const baseStyle: Record<string, string> = {};
  if (props.state === "active") {
    baseStyle.filter = "drop-shadow(0 0 8px rgba(139, 92, 246, 0.4))";
  }
  return baseStyle;
});

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

.timeline-step-compact {
  will-change: gap, padding;
  min-height: 32px;
  contain: layout style;
}

.timeline-node {
  will-change: transform, filter, opacity;
  transform-origin: center;
}

.timeline-spinner-compact {
  transform: scale(0.42);
}

.timeline-connector {
  will-change: background, opacity;
}

.timeline-content {
  will-change: opacity;
  min-width: 0;
}

.timeline-text {
  will-change: font-size, opacity;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

@media (max-width: 240px) {
  .timeline-step-compact {
    gap: 0.375rem !important;
  }

  .timeline-node {
    transform: scale(0.8);
  }

  .timeline-text {
    font-size: 0.5625rem !important;
    line-height: 1.15 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-step-compact,
  .timeline-node,
  .timeline-connector,
  .timeline-content,
  .timeline-text {
    transition: none !important;
    animation: none !important;
  }

  .timeline-node {
    transform: scale(1) !important;
  }

  .animate-pulse-subtle {
    animation: none !important;
  }
}
</style>
