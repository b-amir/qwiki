import { computed, type Ref } from "vue";

interface LoadingStep {
  text: string;
  key: string;
}

type StepState = "completed" | "active" | "pending";

export function useStepStates(
  steps: Ref<LoadingStep[]> | LoadingStep[],
  currentStep: Ref<string | undefined> | string | undefined,
) {
  const stepsRef = "value" in steps ? (steps as Ref<LoadingStep[]>) : computed(() => steps);
  const currentStepRef =
    currentStep && typeof currentStep === "object" && "value" in currentStep
      ? (currentStep as Ref<string | undefined>)
      : computed(() => currentStep as string | undefined);

  const activeIndex = computed(() => {
    if (!currentStepRef.value) return 0;
    const index = stepsRef.value.findIndex((step) => step.key === currentStepRef.value);
    return index === -1 ? 0 : index;
  });

  function generateSkeletonStyle(text: string) {
    const trimmedLength = Math.max(4, text.replace(/\s+/g, " ").trim().length);
    const minChars = 12;
    const maxChars = 68;
    const estimatedChars = Math.round(trimmedLength * 0.95);
    const clamped = Math.min(maxChars, Math.max(minChars, estimatedChars));

    return {
      "--skeleton-ch": `${clamped}`,
    } as Record<string, string>;
  }

  const stepStates = computed(() => {
    return stepsRef.value.map((step, index) => {
      let state: StepState = "pending";
      if (index < activeIndex.value) state = "completed";
      else if (index === activeIndex.value) state = currentStepRef.value ? "active" : "pending";

      const distanceFromActive = activeIndex.value - index;
      const completedDepth =
        state === "completed" && distanceFromActive >= 1 && distanceFromActive <= 3
          ? distanceFromActive
          : 0;

      const pendingDepth =
        state === "pending" && distanceFromActive <= -1 && distanceFromActive >= -3
          ? Math.abs(distanceFromActive)
          : 0;

      return {
        step,
        state,
        completedDepth,
        pendingDepth,
        skeletonStyle: generateSkeletonStyle(step.text),
      } as {
        step: LoadingStep;
        state: StepState;
        completedDepth: number;
        pendingDepth: number;
        skeletonStyle: Record<string, string>;
      };
    });
  });

  const visibleStart = computed(() => Math.max(0, activeIndex.value - 3));
  const visibleEnd = computed(() => Math.min(stepsRef.value.length - 1, activeIndex.value + 3));
  const visibleStepStates = computed(() =>
    stepStates.value.slice(visibleStart.value, visibleEnd.value + 1),
  );
  const activeLocalIndex = computed(() => activeIndex.value - visibleStart.value);

  return {
    activeIndex,
    stepStates,
    visibleStepStates,
    activeLocalIndex,
  };
}
