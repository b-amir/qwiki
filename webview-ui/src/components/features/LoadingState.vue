<template>
  <div class="flex h-full w-full items-center justify-center px-3 sm:px-6">
    <div
      :class="[
        'w-full max-w-md',
        { 'flex !w-auto !max-w-none items-center justify-center': isSingleStep },
      ]"
    >
      <LoadingView
        v-if="useLoadingView"
        :steps="resolvedSteps"
        :current-step="resolvedCurrentStep"
      />
      <DynamicSkeleton
        v-else
        :steps="resolvedSteps"
        :current-step="resolvedCurrentStep"
        :density="resolvedDensity"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import DynamicSkeleton from "@/components/DynamicSkeleton.vue";
import LoadingView from "@/components/LoadingView.vue";
import type { LoadingContext, LoadingDensity, LoadingStepDefinition } from "@/loading/types";
import { isKnownContext } from "@/loading/types";
import { getStepsForContext } from "@/loading/stepCatalog";
import { useLoading } from "@/loading/useLoading";

interface Props {
  context?: LoadingContext;
  steps?: LoadingStepDefinition[];
  currentStep?: string;
  density?: LoadingDensity;
  percent?: number | null;
  isActive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  density: "medium" as LoadingDensity,
});

const loading = props.context
  ? useLoading(props.context, { steps: props.steps, density: props.density })
  : null;

const resolvedSteps = computed<LoadingStepDefinition[]>(() => {
  if (loading) return loading.steps.value;
  if (props.steps?.length) return props.steps;
  if (props.context && isKnownContext(props.context)) return getStepsForContext(props.context);
  return getStepsForContext("wiki");
});

const resolvedCurrentStep = computed(() => {
  if (loading) {
    return loading.state.value.step ?? "";
  }
  return props.currentStep ?? resolvedSteps.value[0]?.key ?? "";
});

const resolvedDensity = computed<LoadingDensity>(() => {
  if (loading) return loading.density.value;
  return props.density ?? "medium";
});

const isSingleStep = computed(() => resolvedSteps.value.length === 1);

const useLoadingView = computed(() => !isSingleStep.value);
</script>
