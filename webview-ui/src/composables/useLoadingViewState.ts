import { computed, type Ref } from "vue";

export interface LoadingStepDefinition {
  key: string;
  text: string;
}

export type StepState = "completed" | "active" | "pending";

export function useLoadingViewState(
  steps: Ref<LoadingStepDefinition[]> | LoadingStepDefinition[],
  currentStep: Ref<string | undefined> | string | undefined,
) {
  const stepsRef = "value" in steps ? (steps as Ref<LoadingStepDefinition[]>) : computed(() => steps);
  const currentStepRef =
    currentStep && typeof currentStep === "object" && "value" in currentStep
      ? (currentStep as Ref<string | undefined>)
      : computed(() => currentStep as string | undefined);

  const currentStepIndex = computed(() => {
    if (!currentStepRef.value) return 0;
    const index = stepsRef.value.findIndex((step) => step.key === currentStepRef.value);
    return index >= 0 ? index : 0;
  });

  const getStepState = (index: number): StepState => {
    const current = currentStepIndex.value;
    if (index < current) return "completed";
    if (index === current) return "active";
    return "pending";
  };

  const getDistanceFromActive = (index: number): number => {
    return index - currentStepIndex.value;
  };

  return {
    currentStepIndex,
    getStepState,
    getDistanceFromActive,
  };
}

