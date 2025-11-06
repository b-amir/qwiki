<template>
  <div :class="['loading-view flex h-full w-full items-center justify-center', containerClasses]">
    <div :class="['loading-view-container w-full', maxWidthClass]">
      <LoadingStep
        v-for="(step, index) in steps"
        :key="step.key"
        :text="step.text"
        :state="getStepState(index)"
        :is-last="index === steps.length - 1"
        :distance-from-active="getDistanceFromActive(index)"
        :variant="variant"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LoadingStep from "./LoadingStep.vue";
import { useLoadingViewState, type LoadingStepDefinition } from "@/composables/useLoadingViewState";
import type { LoadingViewVariant } from "@/loading/loadingViewConfig";

const props = withDefaults(
  defineProps<{
    steps: LoadingStepDefinition[];
    currentStep?: string;
    variant?: LoadingViewVariant;
  }>(),
  {
    currentStep: "",
    variant: "full",
  },
);

const { getStepState, getDistanceFromActive } = useLoadingViewState(
  computed(() => props.steps),
  computed(() => props.currentStep),
);

const variant = computed(() => props.variant);

const containerClasses = computed(() => {
  return variant.value === "full" ? "px-4 py-6" : "px-3 py-4";
});

const maxWidthClass = computed(() => {
  return variant.value === "full" ? "max-w-md" : "max-w-sm";
});
</script>

<style scoped>
.loading-view {
  contain: layout style paint;
}

.loading-view-container {
  contain: layout style;
}
</style>
