import { type Ref } from "vue";
import { createLogger } from "@/utilities/logging";
import type { useWikiStore } from "@/stores/wiki";
import type { useSettingsStore } from "@/stores/settings";
import type { NavigationGuard, ValidationResult, PageType } from "@/stores/navigation";
import { useNavigationStore } from "@/stores/navigation";

const logger = createLogger("SettingsNavigationGuard");

// Helper function to get health check error message
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

// Helper function to perform health check
async function performHealthCheck(
  settings: ReturnType<typeof useSettingsStore>,
  providerConfig: { id: string; name: string; apiKeyUrl?: string },
  apiKey: string,
): Promise<{ isValid: boolean; error?: string; errorCode?: string }> {
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
    });
    return {
      isValid: false,
      error:
        "API key contains invalid characters. API keys should only contain standard ASCII characters (letters, numbers, and basic symbols).",
      errorCode: "API_KEY_INVALID_FORMAT",
    };
  }

  // Client-side validation: Check minimum length
  if (apiKey.length < 10) {
    logger.warn("API key is too short", {
      providerId: settings.selectedProvider,
      length: apiKey.length,
    });
    return {
      isValid: false,
      error: "API key is too short. Please check that you've entered the complete API key.",
      errorCode: "API_KEY_TOO_SHORT",
    };
  }

  logger.debug("Performing API key health check", { providerId: settings.selectedProvider });

  // Wait for health check result
  return new Promise((resolve) => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let eventHandler: ((event: CustomEvent) => void) | null = null;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      if (eventHandler) {
        window.removeEventListener("apiKeyHealthValidated", eventHandler as any);
        eventHandler = null;
      }
    };

    eventHandler = (event: CustomEvent) => {
      const { providerId, isValid, isHealthy, error, errorCode } = event.detail;
      if (providerId === settings.selectedProvider) {
        cleanup();
        resolve({
          isValid: isValid && isHealthy,
          error,
          errorCode,
        });
      }
    };

    window.addEventListener("apiKeyHealthValidated", eventHandler as any);

    timeoutHandle = setTimeout(() => {
      cleanup();
      logger.error("Health check timeout");
      resolve({
        isValid: false,
        error: "API key validation timed out",
        errorCode: "API_KEY_HEALTH_CHECK_TIMEOUT",
      });
    }, 30000);

    // Trigger health check
    settings.validateApiKeyHealth(settings.selectedProvider, apiKey);
  });
}

// Helper function to validate configuration
async function validateConfiguration(
  settings: ReturnType<typeof useSettingsStore>,
  wiki: ReturnType<typeof useWikiStore>,
  providerConfig: { id: string; name: string },
): Promise<{ isValid: boolean; error?: string; errorCode?: string }> {
  logger.debug(`Starting configuration validation for provider ${settings.selectedProvider}`);

  const config = {
    id: providerConfig.id,
    name: providerConfig.name,
    enabled: true,
    apiKey: "", // Not needed for config validation
    model: wiki.model,
  };

  // Trigger configuration validation
  settings.validateConfiguration(config, settings.selectedProvider);

  // Wait for validation result
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      logger.error("Configuration validation timeout");
      resolve({
        isValid: false,
        error: "Configuration validation timed out",
        errorCode: "VALIDATION_TIMEOUT",
      });
    }, 10000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === "configurationValidated") {
        const { isValid, errors = [], providerId } = event.data.payload || {};
        if (providerId === settings.selectedProvider) {
          cleanup();
          if (!isValid && errors.length > 0) {
            const firstError = errors[0];
            const errorMessage =
              typeof firstError === "string"
                ? firstError
                : firstError?.message || "Configuration validation failed";
            const errorCode =
              typeof firstError === "string" ? "VALIDATION_FAILED" : firstError?.code;
            resolve({
              isValid: false,
              error: errorMessage,
              errorCode,
            });
          } else {
            resolve({ isValid: true });
          }
        }
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
    };

    window.addEventListener("message", handleMessage);
  });
}

// Helper function to wait for API keys refresh
async function waitForApiKeysRefresh(): Promise<void> {
  return new Promise((resolve) => {
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
      const { vscode } = require("@/utilities/vscode");
      vscode.postMessage({ command: "getApiKeys" });
      logger.debug("Requested API keys refresh");
    } catch {
      logger.debug("Could not request API keys refresh");
      clearTimeout(timeout);
      window.removeEventListener("message", messageHandler);
      resolve();
    }
  });
}

// Main validation function
async function validateSettings(
  settings: ReturnType<typeof useSettingsStore>,
  wiki: ReturnType<typeof useWikiStore>,
  providerConfigs: Ref<Array<{ id: string; name: string; apiKeyUrl?: string }>>,
  getApiKeyInput: (providerId: string) => string,
): Promise<ValidationResult> {
  logger.debug("Starting settings validation");

  // 1. Ensure settings are saved
  await settings.flushPendingTimers();
  await settings.waitForPendingOperations(3000);
  await waitForApiKeysRefresh();

  // 2. Check for at least one API key
  if (!settings.hasAtLeastOneApiKey) {
    logger.debug("No API key found for any provider - blocking navigation");
    const errorMessage =
      "At least one API key is required. This extension requires an LLM provider to work. You can get a free API key from the links provided in the settings.";
    const errorCode = "error.noApiKeysConfigured";

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

    return {
      allowed: false,
      error: {
        message: errorMessage,
        code: errorCode,
        suggestions,
      },
    };
  }

  // 3. Validate selected provider
  if (!settings.selectedProvider) {
    logger.debug("No provider selected");
    return {
      allowed: false,
      error: {
        message: "Please select a provider",
        code: "NO_PROVIDER_SELECTED",
      },
    };
  }

  const selectedProviderConfig = providerConfigs.value.find(
    (p) => p.id === settings.selectedProvider,
  );

  if (!selectedProviderConfig) {
    logger.debug("Provider config not found");
    return {
      allowed: false,
      error: {
        message: "Selected provider configuration not found",
        code: "PROVIDER_NOT_FOUND",
      },
    };
  }

  // 4. Validate configuration
  const configValid = await validateConfiguration(settings, wiki, selectedProviderConfig);
  if (!configValid.isValid) {
    return {
      allowed: false,
      error: {
        message: configValid.error || "Configuration validation failed",
        code: configValid.errorCode || "VALIDATION_FAILED",
      },
    };
  }

  // 5. Health check
  const apiKey = getApiKeyInput(settings.selectedProvider);
  if (!apiKey || apiKey.trim().length === 0) {
    logger.debug("Skipping health check - no API key provided");
    return {
      allowed: false,
      error: {
        message: "API key is required",
        code: "API_KEY_MISSING",
        suggestions: [
          "Enter your API key in the field above",
          selectedProviderConfig.apiKeyUrl
            ? `Get an API key from ${selectedProviderConfig.apiKeyUrl}`
            : "Get an API key from the provider",
        ],
      },
    };
  }

  const healthCheck = await performHealthCheck(settings, selectedProviderConfig, apiKey.trim());
  if (!healthCheck.isValid) {
    const { message, suggestions } = getHealthCheckErrorMessage(
      healthCheck.errorCode,
      selectedProviderConfig.name,
      selectedProviderConfig.apiKeyUrl,
    );

    return {
      allowed: false,
      error: {
        message,
        code: healthCheck.errorCode || "API_KEY_HEALTH_CHECK_FAILED",
        suggestions,
      },
    };
  }

  logger.debug("Validation and health check passed");
  return { allowed: true };
}

// Create the navigation guard
export function createSettingsNavigationGuard(
  settings: ReturnType<typeof useSettingsStore>,
  wiki: ReturnType<typeof useWikiStore>,
  providerConfigs: Ref<Array<{ id: string; name: string; apiKeyUrl?: string }>>,
  getApiKeyInput: (providerId: string) => string,
): NavigationGuard {
  return async (target: PageType, direction: "forward" | "back"): Promise<ValidationResult> => {
    const navigationStore = useNavigationStore();

    // Check sourcePage (where we're coming from) instead of currentPage
    // because currentPage is optimistically updated before validation
    const fromPage = navigationStore.sourcePage || navigationStore.currentPage;

    // Validate when navigating away from settings (any direction)
    if (fromPage === "settings" && target !== "settings") {
      logger.debug("Navigating away from settings - validating", { target, direction });
      return await validateSettings(settings, wiki, providerConfigs, getApiKeyInput);
    }

    // Allow navigation in all other cases
    return { allowed: true };
  };
}
