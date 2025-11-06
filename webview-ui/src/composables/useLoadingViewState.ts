import { computed, ref, watch, type Ref } from "vue";
import { LoadingViewAnimations } from "@/constants/loadingViewAnimations";

export interface LoadingStepDefinition {
  key: string;
  text: string;
}

export type StepState = "completed" | "active" | "pending";

export function useLoadingViewState(
  steps: Ref<LoadingStepDefinition[]> | LoadingStepDefinition[],
  currentStep: Ref<string | undefined> | string | undefined,
) {
  const stepsRef =
    "value" in steps ? (steps as Ref<LoadingStepDefinition[]>) : computed(() => steps);
  const currentStepRef =
    currentStep && typeof currentStep === "object" && "value" in currentStep
      ? (currentStep as Ref<string | undefined>)
      : computed(() => currentStep as string | undefined);

  const targetStepIndex = computed(() => {
    if (!currentStepRef.value) return 0;
    const index = stepsRef.value.findIndex((step) => step.key === currentStepRef.value);
    return index >= 0 ? index : 0;
  });

  const displayedStepIndex = ref(0);

  let isAnimating = false;
  let currentTimeout: ReturnType<typeof setTimeout> | null = null;

  const animateToNextStep = () => {
    const target = targetStepIndex.value;
    const current = displayedStepIndex.value;

    if (current >= target) {
      isAnimating = false;
      return;
    }

    isAnimating = true;
    displayedStepIndex.value = current + 1;

    const lag = target - (current + 1);
    let delay: number = LoadingViewAnimations.minStepDuration;

    if (lag > LoadingViewAnimations.maxLagSteps) {
      delay = LoadingViewAnimations.fastCatchUpDelay;
    } else if (lag > 1) {
      delay = LoadingViewAnimations.moderateCatchUpDelay;
    }

    currentTimeout = setTimeout(() => {
      animateToNextStep();
    }, delay);
  };

  watch(
    targetStepIndex,
    (newIndex) => {
      const startIndex = displayedStepIndex.value;

      if (newIndex > startIndex) {
        if (!isAnimating) {
          animateToNextStep();
        }
      } else if (newIndex < startIndex) {
        if (currentTimeout) {
          clearTimeout(currentTimeout);
          currentTimeout = null;
        }
        isAnimating = false;
        displayedStepIndex.value = newIndex;
      }
    },
    { immediate: false },
  );

  const getStepState = (index: number): StepState => {
    const current = displayedStepIndex.value;
    if (index < current) return "completed";
    if (index === current) return "active";
    return "pending";
  };

  const getDistanceFromActive = (index: number): number => {
    return index - displayedStepIndex.value;
  };

  return {
    currentStepIndex: displayedStepIndex,
    getStepState,
    getDistanceFromActive,
  };
}
