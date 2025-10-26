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

// Default steps for wiki loading
const wikiSteps: LoadingStep[] = [
  { text: "Validating selection...", key: "validating" },
  { text: "Analyzing code structure...", key: "analyzing" },
  { text: "Finding related files...", key: "finding" },
  { text: "Preparing LLM request...", key: "preparing" },
  { text: "Generating documentation...", key: "generating" },
  { text: "Processing response...", key: "processing" },
  { text: "Finalizing documentation...", key: "finalizing" },
];

// Default steps for settings loading
const settingsSteps: LoadingStep[] = [
  { text: "Loading settings...", key: "loading" },
  { text: "Fetching providers...", key: "fetching" },
  { text: "Preparing configuration...", key: "preparing" },
];

// Use provided steps or default based on density
const steps = computed(() => {
  if (props.steps && props.steps.length > 0) {
    return props.steps;
  }

  // Return appropriate default steps based on density
  if (props.density === "low") {
    return settingsSteps;
  }

  return wikiSteps;
});
</script>
