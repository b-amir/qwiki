import { useErrorStore, type ErrorState } from "@/stores/error";
import { useNavigation } from "./useNavigation";

export function useError() {
  const errorStore = useErrorStore();
  const { currentPage } = useNavigation();

  const showError = (error: Partial<ErrorState> & { message: string }) => {
    errorStore.setError({
      ...error,
      context: {
        page: currentPage.value,
        ...error.context,
      },
    });
  };

  const showRetryableError = (
    message: string,
    retryAction: () => void,
    options?: Partial<ErrorState>,
  ) => {
    showError({
      message,
      retryable: true,
      retryAction,
      actions: [
        {
          label: "Retry",
          action: "none",
          handler: retryAction,
        },
        {
          label: "Dismiss",
          action: "none",
        },
      ],
      ...options,
    });
  };

  const showConfigurationError = (
    message: string,
    code?: string,
    options?: Partial<ErrorState>,
  ) => {
    showError({
      message,
      code,
      category: "configuration",
      actions: [
        {
          label: "Go to Settings",
          action: "navigate",
          target: "settings",
          condition: (page) => page !== "settings",
        },
        {
          label: "Dismiss",
          action: "none",
        },
      ],
      ...options,
    });
  };

  const clearError = () => {
    errorStore.clearError();
  };

  return {
    showError,
    showRetryableError,
    showConfigurationError,
    clearError,
  };
}
