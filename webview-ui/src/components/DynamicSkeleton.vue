<template>
  <div ref="wrapperEl" class="step-wrapper">
    <div ref="viewportEl" class="viewport">
      <div class="step-track" :style="trackStyle">
        <div
          v-for="(item, index) in visibleStepStates"
          :key="item.step.key"
          ref="rowRefs"
          :class="[
            'step-row',
            item.state,
            { center: index === activeLocalIndex },
            item.completedDepth ? `depth-${item.completedDepth}` : '',
            item.pendingDepth ? `depth-${item.pendingDepth}` : '',
          ]"
        >
          <div
            :class="[
              'step-icon',
              {
                active: item.state === 'active',
                completed: item.state === 'completed',
                placeholder: item.state === 'pending',
              },
            ]"
          >
            <template v-if="item.state === 'active'">
              <StepSpinner />
            </template>
            <template v-else-if="item.state === 'completed'">
              <StepCheckIcon />
            </template>
            <template v-else>
              <span class="pending-dot" aria-hidden="true"></span>
            </template>
          </div>

          <div class="step-text-container min-w-0 flex-1">
            <span
              v-if="item.state !== 'pending'"
              :class="[
                'step-text transition-colors',
                item.state === 'completed'
                  ? 'text-muted-foreground completed-text'
                  : 'text-foreground active-text',
              ]"
            >
              {{ item.step.text }}
            </span>
            <div v-else class="skeleton-line" :style="item.skeletonStyle"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import StepSpinner from "./StepSpinner.vue";
import StepCheckIcon from "./StepCheckIcon.vue";
import { useStepStates } from "@/composables/useStepStates";
import { useStepTracking } from "@/composables/useStepTracking";

interface LoadingStep {
  text: string;
  key: string;
}

const props = defineProps<{
  steps?: LoadingStep[];
  currentStep?: string;
  density?: "low" | "medium" | "high";
}>();

const fallbackSteps: LoadingStep[] = [
  { text: "Loading...", key: "loading" },
  { text: "Preparing...", key: "preparing" },
  { text: "Finalizing...", key: "finalizing" },
];

const steps = computed(() => (props.steps && props.steps.length ? props.steps : fallbackSteps));

const { visibleStepStates, activeLocalIndex, activeIndex } = useStepStates(
  steps,
  computed(() => props.currentStep),
);

const { wrapperEl, viewportEl, rowRefs, viewportHeight, rowHeight, rowGap, triggerMeasure } =
  useStepTracking();

watch([steps, activeIndex], triggerMeasure);

const offsetY = computed(() => {
  const h = rowHeight.value;
  const idx = activeLocalIndex.value;
  const center = viewportHeight.value / 2;
  const activeCenter = (idx + 0.5) * h + idx * rowGap;
  return center - activeCenter;
});

const trackStyle = computed(() => {
  return {
    transform: `translate3d(0, ${offsetY.value}px, 0)`,
  } as Record<string, string>;
});
</script>

<style scoped>
.step-wrapper {
  width: 100%;
  height: 100%;
  overflow: visible;
  padding: clamp(0.75rem, 2vw, 1rem);
  box-sizing: border-box;
}

.viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.step-track {
  display: flex;
  flex-direction: column;
  gap: clamp(0.375rem, 1vw, 0.5rem);
  will-change: transform;
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
  min-height: 100%;
  padding: clamp(0.375rem, 1vw, 0.5rem) 0;
}

.step-row {
  display: flex;
  align-items: center;
  gap: clamp(0.375rem, 1vw, 0.5rem);
  min-height: clamp(28px, 8vw, 32px);
  transition:
    gap 180ms ease,
    opacity 180ms ease;
}

.step-row.completed {
  gap: clamp(0.25rem, 0.75vw, 0.375rem);
  opacity: 0.85;
}

.step-row.completed.depth-1 {
  opacity: 0.85;
  filter: blur(0.2px);
}
.step-row.completed.depth-2 {
  opacity: 0.7;
  filter: blur(0.5px);
}
.step-row.completed.depth-3 {
  opacity: 0.55;
  filter: blur(0.8px);
}

.step-row.active {
  gap: clamp(0.5rem, 1.25vw, 0.625rem);
}

.step-row.pending {
  gap: clamp(0.375rem, 1vw, 0.5rem);
}

.step-row.pending.depth-1 {
  opacity: 0.85;
  filter: blur(0.2px);
}
.step-row.pending.depth-2 {
  opacity: 0.7;
  filter: blur(0.5px);
}
.step-row.pending.depth-3 {
  opacity: 0.55;
  filter: blur(0.8px);
}

.skeleton-line {
  height: clamp(1rem, 3vw, 1.25rem);
  border-radius: clamp(0.25rem, 0.5vw, 0.375rem);
  width: min(calc(var(--skeleton-ch) * 1ch), 100%);
  max-width: 100%;
  --skeleton-base: color-mix(in oklab, var(--vscode-widget-border, var(--border)) 80%, transparent);
  --skeleton-highlight: color-mix(
    in oklab,
    var(--primary, var(--vscode-textLink-foreground)) 22%,
    transparent
  );
  background-image: linear-gradient(
    90deg,
    var(--skeleton-base) 0%,
    var(--skeleton-base) 35%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 65%,
    var(--skeleton-base) 100%
  );
  background-size: 220% 100%;
  animation: skeletonShimmer 0.9s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
}

.step-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: clamp(16px, 4vw, 20px);
  height: clamp(16px, 4vw, 20px);
  flex-shrink: 0;
  transition: color 0.2s ease;
}

.step-icon.active {
  color: var(--primary, var(--vscode-textLink-foreground));
  animation: iconPulse 1.2s ease-in-out infinite;
}

.step-icon.completed {
  color: var(--muted-foreground, var(--vscode-descriptionForeground));
}

.step-icon.placeholder {
  color: transparent;
}

.pending-dot {
  width: clamp(6px, 1.5vw, 7px);
  height: clamp(6px, 1.5vw, 7px);
  border-radius: clamp(1px, 0.25vw, 1.5px);
  background: var(--border, var(--vscode-widget-border));
  opacity: 0.4;
  flex-shrink: 0;
}

.step-text-container {
  min-width: 0;
  overflow: hidden;
}

.step-text {
  display: inline-block;
  line-height: clamp(1rem, 3vw, 1.25rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.completed-text {
  font-size: clamp(0.6875rem, 2vw, 0.75rem);
  letter-spacing: -0.005em;
  font-weight: 500;
}

.active-text {
  font-size: clamp(0.8125rem, 2.5vw, 0.875rem);
  font-weight: 600;
  animation: textPulse 1.4s ease-in-out infinite;
}

@keyframes skeletonShimmer {
  0% {
    background-position: 110% 0;
  }
  100% {
    background-position: -110% 0;
  }
}

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
