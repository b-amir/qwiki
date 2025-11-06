import { ref, type Ref } from "vue";
import { createLogger } from "@/utilities/logging";
import type { useWikiStore } from "@/stores/wiki";
import type { useSettingsStore } from "@/stores/settings";
import { useErrorHistoryStore } from "@/stores/errorHistory";
import type { PageType } from "./useNavigation";

const logger = createLogger("SettingsNavigationGuard");

function getHealthCheckErrorMessage(
  errorCode: string | undefined,
  providerName: string,
  apiKeyUrl?: string,
): { message: string; suggestions: string[] } {
  const defaultCode = errorCode || "API_KEY_HEALTH_CHECK_FAILED";
  let errorMessage = "API key validation failed";
  let suggestions: string[] = [];

  if (defaultCode === "API_KEY_INVALID") {
    errorMessage = `The API key for ${providerName} is invalid or unauthorized`;
    suggestions = [
      "Verify your API key is correct",
      "Check if the API key has been revoked",
      apiKeyUrl ? `Get a new API key from ${apiKeyUrl}` : "Get a new API key from the provider",
    ];
  } else if (defaultCode === "API_KEY_INVALID_FORMAT") {
    errorMessage = "API key contains invalid characters";
    suggestions = [
      "API keys should only contain standard ASCII characters (letters, numbers, and basic symbols)",
      "Check for any special Unicode characters or emojis that may have been accidentally copied",
      "Copy the API key again from the provider's website",
      apiKeyUrl ? `Get a new API key from ${apiKeyUrl}` : "Get a new API key from the provider",
    ];
  } else if (defaultCode === "API_KEY_TOO_SHORT") {
    errorMessage = "API key is too short";
    suggestions = [
      "Ensure you've copied the complete API key",
      "API keys are typically at least 20 characters long",
      apiKeyUrl ? `Get your API key from ${apiKeyUrl}` : "Get your API key from the provider",
    ];
  } else if (defaultCode === "API_KEY_MISSING") {
    errorMessage = "API key is required";
    suggestions = [
      "Enter your API key in the field above",
      apiKeyUrl ? `Get an API key from ${apiKeyUrl}` : "Get an API key from the provider",
    ];
  } else if (defaultCode === "API_KEY_HEALTH_CHECK_TIMEOUT") {
    errorMessage = "API key validation timed out";
    suggestions = [
      "Check your internet connection",
      "The provider service may be slow",
      "Try again",
    ];
  } else if (defaultCode === "API_KEY_HEALTH_CHECK_FAILED") {
    errorMessage = "Unable to verify API key - connection failed";
    suggestions = [
      "Check your internet connection",
      "Verify the provider service is accessible",
      "Try again in a moment",
    ];
  } else {
    suggestions = ["Check your API key", "Verify your internet connection", "Try again"];
  }

  return { message: errorMessage, suggestions };
}

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
    performHealthCheck?: () => Promise<void>;
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

      let healthCheckState = {
        completed: false,
        inProgress: false,
        result: null as {
          isValid: boolean;
          error?: string;
          errorCode?: string;
        } | null,
        timeoutHandle: null as ReturnType<typeof setTimeout> | null,
        eventHandler: null as ((event: CustomEvent) => void) | null,
      };

      const resolveHealthCheckResult = (): void => {
        if (!healthCheckState.completed || !healthCheckState.result || resolved) {
          return;
        }

        clearInterval(checkInterval);
        clearTimeout(timeout);

        if (!healthCheckState.result.isValid) {
          logger.debug("Health check failed", healthCheckState.result);
          validating.value = false;
          showValidationErrors.value = true;

          const errorCode = healthCheckState.result.errorCode || "API_KEY_HEALTH_CHECK_FAILED";
          const { message: errorMessage, suggestions } = getHealthCheckErrorMessage(
            errorCode,
            selectedProviderConfig.name,
            selectedProviderConfig.apiKeyUrl,
          );

          validationErrors.value = [
            {
              message: errorMessage,
              code: errorCode,
            },
          ];

          settings.error = errorMessage;
          settings.errorInfo = {
            message: errorMessage,
            code: errorCode,
            suggestions,
            retryable: true,
            timestamp: new Date().toISOString(),
            context: JSON.stringify({ providerId: settings.selectedProvider }),
          };

          const result: ValidationResult = {
            isValid: false,
            errors: validationErrors.value,
            warnings: validationWarnings.value,
          };

          if (pendingNavigation.value) {
            pendingNavigation.value.resolve(false);
            pendingNavigation.value = null;
          } else {
            resolveResult(result);
          }
        } else {
          logger.debug("Validation and health check passed");
          validating.value = false;

          const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: validationWarnings.value,
          };

          if (pendingNavigation.value) {
            pendingNavigation.value.resolve(true);
            pendingNavigation.value = null;
          } else {
            resolveResult(result);
          }
        }
      };

      const performHealthCheck = async (): Promise<void> => {
        if (healthCheckState.inProgress) {
          logger.debug("Health check already in progress");
          return;
        }

        let apiKey = getApiKeyInput(settings.selectedProvider);
        if (!apiKey || apiKey.trim().length === 0) {
          logger.debug("Skipping health check - no API key provided");
          healthCheckState.completed = true;
          healthCheckState.result = {
            isValid: false,
            error: "API key is required",
            errorCode: "API_KEY_MISSING",
          };
          resolveHealthCheckResult();
          return;
        }

        apiKey = apiKey.trim();

        // Client-side validation: Check for non-ASCII characters
        const nonAsciiChars: string[] = [];
        for (let i = 0; i < apiKey.length; i++) {
          const char = apiKey[i];
          const code = char.charCodeAt(0);
          if (code > 127) {
            nonAsciiChars.push(`${char} (U+${code.toString(16).toUpperCase().padStart(4, "0")})`);
          }
        }

        if (nonAsciiChars.length > 0) {
          logger.warn("API key contains non-ASCII characters", {
            providerId: settings.selectedProvider,
            nonAsciiChars,
            apiKeyLength: apiKey.length,
            apiKeyPreview: apiKey.substring(0, 20) + "...",
          });
          healthCheckState.completed = true;
          healthCheckState.result = {
            isValid: false,
            error:
              "API key contains invalid characters. API keys should only contain standard ASCII characters (letters, numbers, and basic symbols).",
            errorCode: "API_KEY_INVALID_FORMAT",
          };
          resolveHealthCheckResult();
          return;
        }

        // Client-side validation: Check minimum length
        if (apiKey.length < 10) {
          logger.warn("API key is too short", {
            providerId: settings.selectedProvider,
            length: apiKey.length,
          });
          healthCheckState.completed = true;
          healthCheckState.result = {
            isValid: false,
            error: "API key is too short. Please check that you've entered the complete API key.",
            errorCode: "API_KEY_TOO_SHORT",
          };
          resolveHealthCheckResult();
          return;
        }

        logger.debug("Performing API key health check", { providerId: settings.selectedProvider });
        healthCheckState.inProgress = true;

        const handleHealthCheckResult = (event: CustomEvent) => {
          const { providerId, isValid, isHealthy, error, errorCode } = event.detail;
          if (providerId === settings.selectedProvider) {
            if (healthCheckState.timeoutHandle) {
              clearTimeout(healthCheckState.timeoutHandle);
              healthCheckState.timeoutHandle = null;
            }
            if (healthCheckState.eventHandler) {
              window.removeEventListener(
                "apiKeyHealthValidated",
                healthCheckState.eventHandler as any,
              );
              healthCheckState.eventHandler = null;
            }
            healthCheckState.completed = true;
            healthCheckState.inProgress = false;
            healthCheckState.result = {
              isValid: isValid && isHealthy,
              error,
              errorCode,
            };
            logger.debug("Health check completed", {
              providerId,
              isValid: healthCheckState.result.isValid,
              error,
            });
            resolveHealthCheckResult();
          }
        };

        healthCheckState.eventHandler = handleHealthCheckResult;
        window.addEventListener("apiKeyHealthValidated", handleHealthCheckResult as any);

        healthCheckState.timeoutHandle = setTimeout(() => {
          if (!healthCheckState.completed) {
            logger.error("Health check timeout");
            if (healthCheckState.eventHandler) {
              window.removeEventListener(
                "apiKeyHealthValidated",
                healthCheckState.eventHandler as any,
              );
              healthCheckState.eventHandler = null;
            }
            healthCheckState.completed = true;
            healthCheckState.inProgress = false;
            healthCheckState.result = {
              isValid: false,
              error: "API key validation timed out",
              errorCode: "API_KEY_HEALTH_CHECK_TIMEOUT",
            };
            resolveHealthCheckResult();
          }
        }, 30000);

        await settings.validateApiKeyHealth(settings.selectedProvider, apiKey);
      };

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
      }, 35000);

      const checkInterval = setInterval(() => {
        if (lastValidationValid.value !== null && !resolved) {
          if (validating.value && !healthCheckState.completed) {
            return;
          }
          if (lastValidationValid.value === false) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            logger.debug("Validation failed, blocking navigation");

            const result: ValidationResult = {
              isValid: false,
              errors: validationErrors.value,
              warnings: validationWarnings.value,
            };

            if (pendingNavigation.value) {
              pendingNavigation.value.resolve(false);
              pendingNavigation.value = null;
            } else {
              resolveResult(result);
            }
            return;
          }

          if (lastValidationValid.value === true && !healthCheckState.completed) {
            if (!healthCheckState.inProgress) {
              performHealthCheck().catch((error) => {
                logger.error("Health check error", error);
                healthCheckState.completed = true;
                healthCheckState.inProgress = false;
                healthCheckState.result = {
                  isValid: false,
                  error: error?.message || "Health check failed",
                  errorCode: "API_KEY_HEALTH_CHECK_FAILED",
                };
                resolveHealthCheckResult();
              });
            }
            return;
          }

          if (
            lastValidationValid.value === true &&
            healthCheckState.completed &&
            healthCheckState.result
          ) {
            resolveHealthCheckResult();
          }
        }
      }, 100);

      if (pendingNavigation.value) {
        pendingNavigation.value.timeoutHandle = timeout;
        pendingNavigation.value.intervalHandle = checkInterval;
        pendingNavigation.value.performHealthCheck = performHealthCheck;
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

    if (!isValid) {
      validating.value = false;
      showValidationErrors.value = true;
      logger.debug(`Validation failed, showing ${validationErrors.value.length} errors`);

      if (pendingNavigation.value.timeoutHandle) {
        clearTimeout(pendingNavigation.value.timeoutHandle);
      }
      if (pendingNavigation.value.intervalHandle) {
        clearInterval(pendingNavigation.value.intervalHandle);
      }

      pendingNavigation.value.resolve(false);
      pendingNavigation.value = null;
    } else {
      logger.debug("Configuration validation passed, triggering health check immediately");
      if (pendingNavigation.value?.performHealthCheck) {
        pendingNavigation.value.performHealthCheck().catch((error) => {
          logger.error("Health check error", error);
        });
      }
    }
  };

  return {
    validateAndNavigate,
    handleValidationComplete,
    showSuccessMessage,
    pendingNavigation,
  };
}
