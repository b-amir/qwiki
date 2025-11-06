<template>
  <div
    ref="wrapperEl"
    class="dynamic-skeleton-wrapper box-border h-full w-full overflow-visible p-3 sm:p-4"
  >
    <div ref="viewportEl" class="dynamic-skeleton-viewport relative h-full w-full overflow-visible">
      <div
        ref="trackEl"
        class="dynamic-skeleton-track flex min-h-full flex-col gap-1.5 py-1.5 transition-transform duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform sm:gap-2 sm:py-2"
        :style="trackStyle"
      >
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
import { computed, watch, ref, onMounted } from "vue";
import StepRow from "./StepRow.vue";
import { useStepStates } from "@/composables/useStepStates";
import { useStepTracking } from "@/composables/useStepTracking";
import { useGPULayer } from "@/composables/useAnimationOptimization";

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

const trackEl = ref<HTMLElement | null>(null);

const { promoteToGPULayer: promoteTrackToGPU } = useGPULayer(trackEl);

onMounted(() => {
  promoteTrackToGPU();
});

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
.dynamic-skeleton-wrapper {
  contain: layout style paint;
}

.dynamic-skeleton-viewport {
  contain: layout style;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.dynamic-skeleton-track {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}
</style>
