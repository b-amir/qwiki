import { computed, ref, watch, nextTick, type Ref } from "vue";
import { LoadingViewAnimations } from "@/constants/loadingViewAnimations";
import { createLogger } from "@/utilities/logging";

export interface LoadingStepDefinition {
  key: string;
  text: string;
}

export type StepState = "completed" | "active" | "pending";

const logger = createLogger("useLoadingViewState");

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
  let isInitialized = false;

  let isAnimating = false;
  let currentTimeout: ReturnType<typeof setTimeout> | null = null;

  const animateToNextStep = () => {
    const target = targetStepIndex.value;
    const current = displayedStepIndex.value;

    if (current >= target) {
      isAnimating = false;
      if (currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
      }
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

    if (currentTimeout) {
      clearTimeout(currentTimeout);
    }
    currentTimeout = setTimeout(() => {
      currentTimeout = null;
      animateToNextStep();
    }, delay);
  };

  const initializeDisplayedStep = () => {
    if (isInitialized) return;
    const target = targetStepIndex.value;
    displayedStepIndex.value = target;
    isInitialized = true;
  };

  nextTick(() => {
    initializeDisplayedStep();
  });

  watch(
    targetStepIndex,
    (newIndex) => {
      if (!isInitialized) {
        initializeDisplayedStep();
        return;
      }

      const startIndex = displayedStepIndex.value;

      if (newIndex > startIndex) {
        if (!isAnimating) {
          if (currentTimeout) {
            clearTimeout(currentTimeout);
            currentTimeout = null;
          }
          isAnimating = false;
          animateToNextStep();
        }
      } else if (newIndex < startIndex) {
        logger.warn("Prevented backward step progression", {
          newIndex,
          startIndex,
          targetStep: currentStepRef.value,
        });
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
