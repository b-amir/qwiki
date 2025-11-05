<template>
  <div class="timeline-loader flex h-full w-full items-center justify-center px-4 py-6">
    <div class="timeline-container w-full max-w-md">
      <TimelineStep
        v-for="(step, index) in steps"
        :key="step.key"
        :text="step.text"
        :state="getStepState(index)"
        :is-last="index === steps.length - 1"
        :distance-from-active="getDistanceFromActive(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import TimelineStep from "./TimelineStep.vue";

interface TimelineStepDefinition {
  key: string;
  text: string;
}

const props = withDefaults(
  defineProps<{
    steps: TimelineStepDefinition[];
    currentStep?: string;
  }>(),
  {
    currentStep: "",
  },
);

const currentStepIndex = computed(() => {
  if (!props.currentStep) return 0;
  const index = props.steps.findIndex((step) => step.key === props.currentStep);
  return index >= 0 ? index : 0;
});

const getStepState = (index: number): "completed" | "active" | "pending" => {
  const current = currentStepIndex.value;
  if (index < current) return "completed";
  if (index === current) return "active";
  return "pending";
};

const getDistanceFromActive = (index: number): number => {
  return index - currentStepIndex.value;
};
</script>

<style scoped>
.timeline-loader {
  contain: layout style paint;
}

.timeline-container {
  contain: layout style;
}
</style>
