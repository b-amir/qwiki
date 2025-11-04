import { ref, type Ref } from "vue";
import { createLogger } from "@/utilities/logging";
import type { useWikiStore } from "@/stores/wiki";
import type { useSettingsStore } from "@/stores/settings";
import { useErrorHistoryStore } from "@/stores/errorHistory";
import type { PageType } from "./useNavigation";

const logger = createLogger("SettingsNavigationGuard");

export interface ValidationResult {
  isValid: boolean;
  errors: Array<string | { field?: string; code?: string; message: string; severity?: string }>;
  warnings: Array<string | { field?: string; code?: string; message: string }>;
}

export function useSettingsNavigationGuard(
  wiki: ReturnType<typeof useWikiStore>,
  settings: ReturnType<typeof useSettingsStore>,
  providerConfigs: Ref<Array<{ id: string; name: string; apiKeyUrl?: string }>>,
  getApiKeyInput: (providerId: string) => string,
  validating: Ref<boolean>,
  lastValidationValid: Ref<boolean | null>,
  showValidationErrors: Ref<boolean>,
  validationErrors: Ref<
    Array<string | { field?: string; code?: string; message: string; severity?: string }>
  >,
  validationWarnings: Ref<Array<string | { field?: string; code?: string; message: string }>>,
) {
  const pendingNavigation = ref<{
    target: PageType;
    isBack: boolean;
    resolve: (value: boolean) => void;
    timeoutHandle?: ReturnType<typeof setTimeout>;
    intervalHandle?: ReturnType<typeof setInterval>;
  } | null>(null);
  const showSuccessMessage = ref(false);

  const waitForApiKeysRefresh = (): Promise<void> => {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        logger.debug("API keys refresh timeout - using current values");
        window.removeEventListener("message", messageHandler);
        resolve();
      }, 2000);

      const messageHandler = (event: MessageEvent) => {
        if (event.data.command === "apiKeys") {
          clearTimeout(timeout);
          window.removeEventListener("message", messageHandler);
          logger.debug("API keys refresh received");
          resolve();
        }
      };

      window.addEventListener("message", messageHandler);

      try {
        const { vscode } = await import("@/utilities/vscode");
        vscode.postMessage({ command: "getApiKeys" });
        logger.debug("Requested API keys refresh");
      } catch {
        logger.debug("Could not request API keys refresh");
        clearTimeout(timeout);
        window.removeEventListener("message", messageHandler);
        resolve();
      }
    });
  };

  const refreshApiKeys = async (): Promise<void> => {
    const waitForSaving = async (): Promise<void> => {
      let waited = 0;
      const maxWait = 1000;
      while (settings.saving && waited < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        waited += 50;
      }
    };

    await waitForSaving();
    await settings.flushPendingTimers();
    await settings.waitForPendingOperations(3000);
    await waitForApiKeysRefresh();
  };

  const validateAndNavigate = async (
    target: PageType,
    isBack: boolean,
  ): Promise<ValidationResult> => {
    logger.debug(`validateAndNavigate called - target: ${target}, isBack: ${isBack}`);

    if (pendingNavigation.value) {
      logger.debug("Cancelling previous navigation attempt");
      if (pendingNavigation.value.timeoutHandle) {
        clearTimeout(pendingNavigation.value.timeoutHandle);
      }
      if (pendingNavigation.value.intervalHandle) {
        clearInterval(pendingNavigation.value.intervalHandle);
      }
      pendingNavigation.value.resolve(false);
    }

    await refreshApiKeys();

    if (!settings.hasAtLeastOneApiKey) {
      logger.debug("No API key found for any provider - blocking navigation");
      const errorMessage =
        "At least one API key is required. This extension requires an LLM provider to work. You can get a free API key from the links provided in the settings.";
      const errorCode = "error.noApiKeysConfigured";

      showValidationErrors.value = false;
      validationErrors.value = [
        {
          message: errorMessage,
          code: errorCode,
        },
      ];

      const suggestions = [
        "Visit one of the provider links to get a free API key",
        "Enter the API key in any provider's API Key field",
        "You need at least one API key for the extension to work",
      ];

      const providerLinks = providerConfigs.value
        .filter((p) => p.apiKeyUrl)
        .map((p) => `${p.name}: ${p.apiKeyUrl}`);

      if (providerLinks.length > 0) {
        suggestions.push(...providerLinks);
      }

      const errorInfo = {
        message: errorMessage,
        code: errorCode,
        suggestions,
        retryable: false,
        timestamp: new Date().toISOString(),
        context: JSON.stringify({ providerId: null, globalError: true }),
      };

      logger.debug("Setting error in settings store", {
        errorMessage,
        errorCode,
        errorInfo,
      });

      settings.error = errorMessage;
      settings.errorInfo = errorInfo;

      logger.debug("Error set in settings store", {
        error: settings.error,
        errorInfo: settings.errorInfo,
        errorModalShouldOpen: true,
      });

      const errorHistory = useErrorHistoryStore();
      errorHistory.addError({
        ...errorInfo,
        timestamp: errorInfo.timestamp || new Date().toISOString(),
      });

      return {
        isValid: false,
        errors: [
          {
            message: errorMessage,
            code: errorCode,
          },
        ],
        warnings: [],
      };
    }

    if (!settings.selectedProvider) {
      logger.debug("No provider selected");
      showValidationErrors.value = true;
      validationErrors.value = [
        { message: "Please select a provider", code: "NO_PROVIDER_SELECTED" },
      ];
      return {
        isValid: false,
        errors: [{ message: "Please select a provider", code: "NO_PROVIDER_SELECTED" }],
        warnings: [],
      };
    }

    const selectedProviderConfig = providerConfigs.value.find(
      (p) => p.id === settings.selectedProvider,
    );

    if (!selectedProviderConfig) {
      logger.debug("Provider config not found");
      showValidationErrors.value = true;
      validationErrors.value = [
        { message: "Selected provider configuration not found", code: "PROVIDER_NOT_FOUND" },
      ];
      return {
        isValid: false,
        errors: [
          { message: "Selected provider configuration not found", code: "PROVIDER_NOT_FOUND" },
        ],
        warnings: [],
      };
    }

    const config = {
      id: selectedProviderConfig.id,
      name: selectedProviderConfig.name || settings.selectedProvider,
      enabled: true,
      apiKey: getApiKeyInput(settings.selectedProvider),
      model: wiki.model,
    };

    logger.debug(`Starting validation for provider ${settings.selectedProvider}`);
    validating.value = true;
    lastValidationValid.value = null;
    showValidationErrors.value = false;
    validationErrors.value = [];
    validationWarnings.value = [];

    return new Promise((resolvePromise) => {
      let resolved = false;

      const resolveResult = (result: ValidationResult) => {
        if (!resolved) {
          resolved = true;
          logger.debug(`Resolving validation result - isValid: ${result.isValid}`);
          resolvePromise(result);
        }
      };

      pendingNavigation.value = {
        target,
        isBack,
        resolve: (isValid: boolean) => {
          logger.debug(`Resolving pending navigation - isValid: ${isValid}`);
          resolveResult({
            isValid,
            errors: validationErrors.value,
            warnings: validationWarnings.value,
          });
        },
      };

      settings.validateConfiguration(config, settings.selectedProvider);

      const timeout = setTimeout(() => {
        if (pendingNavigation.value && !resolved) {
          logger.error("Validation timeout");
          validating.value = false;
          showValidationErrors.value = true;
          validationErrors.value = [
            { message: "Validation timed out", code: "VALIDATION_TIMEOUT" },
          ];
          const pending = pendingNavigation.value;
          pendingNavigation.value = null;
          if (pending.intervalHandle) {
            clearInterval(pending.intervalHandle);
          }
          pending.resolve(false);
          resolveResult({
            isValid: false,
            errors: [{ message: "Validation timed out", code: "VALIDATION_TIMEOUT" }],
            warnings: [],
          });
        }
      }, 30000);

      const checkInterval = setInterval(() => {
        if (lastValidationValid.value !== null && !validating.value && !resolved) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          logger.debug(`Check interval resolved - isValid: ${lastValidationValid.value === true}`);

          const result: ValidationResult = {
            isValid: lastValidationValid.value === true,
            errors: validationErrors.value,
            warnings: validationWarnings.value,
          };

          if (pendingNavigation.value) {
            pendingNavigation.value.resolve(result.isValid);
            pendingNavigation.value = null;
          } else {
            resolveResult(result);
          }
        }
      }, 100);

      if (pendingNavigation.value) {
        pendingNavigation.value.timeoutHandle = timeout;
        pendingNavigation.value.intervalHandle = checkInterval;
      }
    });
  };

  const handleValidationComplete = (isValid: boolean, errors: any[], warnings: any[]): void => {
    logger.debug(
      `Validation complete - isValid: ${isValid}, errors: ${errors.length}, warnings: ${warnings.length}`,
    );

    if (!pendingNavigation.value) {
      return;
    }

    validating.value = false;
    lastValidationValid.value = isValid;

    validationErrors.value = errors.map((e: any) => {
      if (typeof e === "string") return e;
      return {
        field: e?.field,
        code: e?.code,
        message: e?.message || e?.error || JSON.stringify(e),
        severity: e?.severity,
      };
    });

    validationWarnings.value = warnings.map((w: any) => {
      if (typeof w === "string") return w;
      return {
        field: w?.field,
        code: w?.code,
        message: w?.message || w?.warning || JSON.stringify(w),
      };
    });

    if (pendingNavigation.value.timeoutHandle) {
      clearTimeout(pendingNavigation.value.timeoutHandle);
    }
    if (pendingNavigation.value.intervalHandle) {
      clearInterval(pendingNavigation.value.intervalHandle);
    }

    if (isValid) {
      showSuccessMessage.value = true;
      showValidationErrors.value = false;
      settings.clearValidationErrors();
      setTimeout(() => {
        showSuccessMessage.value = false;
      }, 3000);
    } else {
      showValidationErrors.value = true;
      logger.debug(`Validation failed, showing ${validationErrors.value.length} errors`);
    }

    pendingNavigation.value.resolve(isValid);
    pendingNavigation.value = null;
  };

  return {
    validateAndNavigate,
    handleValidationComplete,
    showSuccessMessage,
    pendingNavigation,
  };
}
