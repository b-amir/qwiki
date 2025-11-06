<template>
  <div
    ref="containerRef"
    :class="['loading-step-container relative flex items-center transition-all', containerClasses]"
    :style="containerStyle"
  >
    <div class="loading-step-node-wrapper relative flex flex-col items-center">
      <div
        ref="nodeRef"
        :class="[
          'loading-step-node relative z-10 flex items-center justify-center transition-all',
          nodeClasses,
        ]"
        :style="computedNodeStyle"
      >
        <StepSpinner
          v-if="state === 'active'"
          :class="[
            'loading-step-spinner',
            variant === 'compact' ? 'loading-step-spinner-compact' : '',
          ]"
        />
        <svg
          v-else-if="state === 'completed'"
          :width="config.nodeSize"
          :height="config.nodeSize"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          class="transition-all"
          :style="{ transitionDuration: `${config.duration.base}ms` }"
        >
          <DotShape
            fill="currentColor"
            x="7.5"
            y="7.5"
            :dot-size="9"
            class="text-muted-foreground"
          />
        </svg>
        <svg
          v-else
          :width="config.nodeSize"
          :height="config.nodeSize"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          class="transition-all"
          :style="{ transitionDuration: `${config.duration.base}ms` }"
        >
          <DotShape
            fill="currentColor"
            x="7.5"
            y="7.5"
            :dot-size="9"
            class="text-muted-foreground"
          />
        </svg>
      </div>

      <div
        v-if="!isLast"
        :class="[
          'loading-step-connector bg-muted-foreground absolute left-1/2 h-full -translate-x-1/2 rounded-full transition-all',
          connectorClasses,
        ]"
        :style="{ top: config.connectorTop, ...connectorStyle }"
      ></div>
    </div>

    <div :class="['loading-step-content flex-1 transition-all', contentClasses]">
      <div :class="['loading-step-text break-words transition-all', textClasses]">
        {{ text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import DotShape from "./DotShape.vue";
import StepSpinner from "./StepSpinner.vue";
import { useLoadingViewStyles } from "@/composables/useLoadingViewStyles";
import type { LoadingViewVariant } from "@/loading/loadingViewConfig";
import { useGPULayer } from "@/composables/useAnimationOptimization";

type StepState = "completed" | "active" | "pending";

const props = withDefaults(
  defineProps<{
    text: string;
    state: StepState;
    isLast?: boolean;
    distanceFromActive?: number;
    variant?: LoadingViewVariant;
  }>(),
  {
    isLast: false,
    distanceFromActive: 0,
    variant: "full",
  },
);

const variant = computed(() => props.variant);

const { config, containerStyle, nodeStyle, connectorStyle, getActiveNodeStyle } =
  useLoadingViewStyles(
    variant,
    computed(() => props.distanceFromActive),
  );

const containerRef = ref<HTMLElement | null>(null);
const nodeRef = ref<HTMLElement | null>(null);

const { promoteToGPULayer } = useGPULayer(containerRef);
const { promoteToGPULayer: promoteNodeToGPU } = useGPULayer(nodeRef);

onMounted(() => {
  promoteToGPULayer();
  promoteNodeToGPU();
});

const computedNodeStyle = computed(() => {
  if (props.state === "active") {
    return getActiveNodeStyle();
  }
  return nodeStyle.value;
});

const containerClasses = computed(() => {
  const base = [
    `duration-${config.value.duration.base}`,
    config.value.easing,
    config.value.containerGap.base,
    config.value.containerPaddingBottom.base,
  ];
  if (config.value.containerGap.sm) base.push(config.value.containerGap.sm);
  if (config.value.containerPaddingBottom.sm) base.push(config.value.containerPaddingBottom.sm);
  return base.join(" ");
});

const nodeClasses = computed(() => {
  const classes = [`duration-${config.value.duration.base}`, config.value.easing];
  if (props.state === "active") {
    classes.push(variant.value === "full" ? "scale-110 sm:scale-125" : "scale-110");
  } else {
    classes.push("animate-pulse-subtle scale-100");
    classes.push(variant.value === "full" ? "opacity-70" : "opacity-65");
  }
  return classes.join(" ");
});

const connectorClasses = computed(() => {
  return [
    `duration-${config.value.duration.connector}`,
    config.value.easing,
    config.value.connectorWidth,
  ].join(" ");
});

const contentClasses = computed(() => {
  const classes = [`duration-${config.value.duration.base}`, config.value.easing];
  if (props.state === "active") {
    classes.push("translate-x-0 opacity-100");
  } else {
    classes.push("animate-pulse-subtle translate-x-0");
    classes.push(variant.value === "full" ? "opacity-70" : "opacity-65");
  }
  return classes.join(" ");
});

const textClasses = computed(() => {
  const classes = [`duration-${config.value.duration.base}`, config.value.easing];
  if (props.state === "active") {
    classes.push("text-foreground font-semibold leading-snug");
    classes.push(config.value.textSizes.active.base);
    if (config.value.textSizes.active.sm) classes.push(config.value.textSizes.active.sm);
  } else {
    classes.push("text-muted-foreground font-medium leading-tight");
    classes.push(config.value.textSizes.inactive.base);
  }
  return classes.join(" ");
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

.loading-step-container {
  will-change: gap, padding-bottom;
  contain: layout style paint;
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
}

.loading-step-node {
  will-change: transform, filter, opacity;
  transform-origin: center;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.loading-step-spinner {
  display: block;
  transform: scale(0.58);
  will-change: transform;
  transition: none;
}

.loading-step-node.scale-110 .loading-step-spinner {
  transform: scale(calc(0.58 / 1.1));
}

.loading-step-node.scale-125 .loading-step-spinner {
  transform: scale(calc(0.58 / 1.25));
}

.loading-step-spinner-compact {
  transform: scale(0.42);
  will-change: transform;
  transition: none;
}

.loading-step-node.scale-110 .loading-step-spinner-compact {
  transform: scale(calc(0.42 / 1.1));
}

.loading-step-connector {
  will-change: background, opacity;
  transform: translateZ(0);
}

.loading-step-content {
  will-change: transform, opacity;
  min-width: 0;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.loading-step-text {
  will-change: font-size, opacity;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

@media (max-width: 280px) {
  .loading-step-container {
    gap: 0.5rem !important;
    padding-bottom: 0.75rem !important;
  }

  .loading-step-node {
    transform: scale(0.85) translateZ(0);
  }

  .loading-step-text {
    font-size: 0.625rem !important;
    line-height: 1.2 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-step-container,
  .loading-step-node,
  .loading-step-connector,
  .loading-step-content,
  .loading-step-text {
    transition: none !important;
    animation: none !important;
  }

  .loading-step-node {
    transform: scale(1) translateZ(0) !important;
  }

  .animate-pulse-subtle {
    animation: none !important;
  }
}
</style>
