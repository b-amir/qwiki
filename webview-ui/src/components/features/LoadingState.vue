<template>
  <div class="h-full">
    <DynamicSkeleton :steps="steps" :current-step="currentStep" :density="density" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import DynamicSkeleton from "@/components/DynamicSkeleton.vue";

interface LoadingStep {
  text: string;
  key: string;
}

interface Props {
  steps: LoadingStep[];
  currentStep: string;
  density: "low" | "medium" | "high";
}

const props = withDefaults(defineProps<Props>(), {
  density: "medium",
});

const wikiSteps: LoadingStep[] = [
  { text: "Validating selection...", key: "validating" },
  { text: "Analyzing code structure...", key: "analyzing" },
  { text: "Finding related files...", key: "finding" },
  { text: "Preparing LLM request...", key: "preparing" },
  { text: "Generating documentation...", key: "generating" },
  { text: "Processing response...", key: "processing" },
  { text: "Finalizing documentation...", key: "finalizing" },
];

const settingsSteps: LoadingStep[] = [
  { text: "Loading settings...", key: "loading" },
  { text: "Fetching providers...", key: "fetching" },
  { text: "Preparing configuration...", key: "preparing" },
];

const steps = computed(() => {
  if (props.steps && props.steps.length > 0) {
    return props.steps;
  }

  if (props.density === "low") {
    return settingsSteps;
  }

  return wikiSteps;
});
</script>
