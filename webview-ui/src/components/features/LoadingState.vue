<template>
  <div class="flex h-full w-full items-center justify-center px-16">
    <div class="w-full max-w-md">
      <DynamicSkeleton :steps="steps" :current-step="currentStep" :density="density" />
    </div>
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
  { text: "Building documentation prompt...", key: "buildingPrompt" },
  { text: "Sending request to LLM...", key: "sendingRequest" },
  { text: "Waiting for LLM response...", key: "waitingForResponse" },
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
