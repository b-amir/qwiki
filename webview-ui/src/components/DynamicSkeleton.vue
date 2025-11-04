<template>
  <div ref="wrapperEl" class="step-wrapper">
    <div ref="viewportEl" class="viewport">
      <div class="step-track" :style="trackStyle">
        <StepRow
          v-for="(item, index) in visibleStepStates"
          :key="item.step.key"
          :ref="(el) => setRowRef(el, index)"
          :text="item.step.text"
          :state="item.state"
          :is-center="index === activeLocalIndex"
          :completed-depth="item.completedDepth"
          :pending-depth="item.pendingDepth"
          :skeleton-style="item.skeletonStyle"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import StepRow from "./StepRow.vue";
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

function setRowRef(el: unknown, index: number) {
  if (el && typeof el === "object" && "rowRef" in el) {
    const rowElement = (el as { rowRef: HTMLElement | null }).rowRef;
    if (rowElement) {
      rowRefs.value[index] = rowElement;
    }
  }
}

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
</style>
