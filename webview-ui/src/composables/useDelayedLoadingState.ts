import { ref, watch, computed, onUnmounted, type Ref } from "vue";
import { LoadingViewAnimations } from "@/constants/loadingViewAnimations";

/**
 * Delays the transition from loading to loaded state to ensure
 * loading animations have time to complete, improving UX.
 */
export function useDelayedLoadingState(
  isLoading: Ref<boolean>,
  stepCount: Ref<number>,
  options: {
    minDisplayTime?: number;
    perStepDelay?: number;
  } = {},
) {
  const { minDisplayTime = 300, perStepDelay = LoadingViewAnimations.minStepDuration } = options;

  const displayLoading = ref(isLoading.value);
  const loadingStartTime = ref<number | null>(null);
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearHideTimeout = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  };

  watch(
    isLoading,
    (newValue) => {
      if (newValue) {
        // Started loading
        clearHideTimeout();
        loadingStartTime.value = Date.now();
        displayLoading.value = true;
      } else {
        // Finished loading - calculate delay to ensure animations complete
        const elapsedTime = loadingStartTime.value ? Date.now() - loadingStartTime.value : 0;

        // Calculate minimum time needed for animations
        // Give extra time for the last few steps to be visible
        const animationTime = stepCount.value * perStepDelay;
        const remainingTime = Math.max(0, animationTime - elapsedTime);

        // Ensure at least minDisplayTime total
        const totalDelay = Math.max(minDisplayTime - elapsedTime, remainingTime);

        if (totalDelay > 0) {
          clearHideTimeout();
          hideTimeout = setTimeout(() => {
            displayLoading.value = false;
            loadingStartTime.value = null;
          }, totalDelay);
        } else {
          displayLoading.value = false;
          loadingStartTime.value = null;
        }
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    clearHideTimeout();
  });

  return {
    displayLoading: computed(() => displayLoading.value),
  };
}
