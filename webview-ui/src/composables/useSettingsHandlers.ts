import type { Ref } from "vue";
import { vscode } from "@/utilities/vscode";
import { createLogger } from "@/utilities/logging";
import type { useWikiStore } from "@/stores/wiki";
import type { useSettingsStore } from "@/stores/settings";

interface ProviderConfig {
  id: string;
  name: string;
}

export function useSettingsHandlers(
  wiki: ReturnType<typeof useWikiStore>,
  settings: ReturnType<typeof useSettingsStore>,
  providerConfigs: Ref<ProviderConfig[]>,
  validating: Ref<boolean>,
  lastValidationValid: Ref<boolean | null>,
  showValidationErrors: Ref<boolean>,
  validationErrors: Ref<
    Array<string | { field?: string; code?: string; message: string; severity?: string }>
  >,
  validationWarnings: Ref<Array<string | { field?: string; code?: string; message: string }>>,
  getApiKeyInput: (providerId: string) => string,
) {
  const logger = createLogger("SettingsHandlers");

  const validateCurrentConfiguration = () => {
    const validationStartTime = Date.now();
    logger.debug(`Validating configuration for provider ${settings.selectedProvider}`);

    try {
      const selectedProviderConfig = providerConfigs.value.find(
        (p) => p.id === settings.selectedProvider,
      );

      if (selectedProviderConfig) {
        const config = {
          id: selectedProviderConfig.id,
          name: selectedProviderConfig.name || settings.selectedProvider,
          enabled: true,
          apiKey: getApiKeyInput(settings.selectedProvider),
          model: wiki.model,
        };

        validating.value = true;
        lastValidationValid.value = null;
        settings.validateConfiguration(config, settings.selectedProvider);
        showValidationErrors.value = true;
        validationErrors.value = settings.validationErrors;
        validationWarnings.value = settings.validationWarnings;

        const validationEndTime = Date.now();
        logger.debug(
          `Configuration validation completed in ${validationEndTime - validationStartTime}ms`,
        );
      } else {
        logger.error(`Selected provider config not found for ${settings.selectedProvider}`);
      }
    } catch (error) {
      logger.error(
        `Error validating configuration for provider ${settings.selectedProvider}:`,
        error,
      );
    }
  };

  const handleProviderChange = (providerId: string) => {
    const changeStartTime = Date.now();
    logger.debug(`Changing provider to ${providerId}`);

    try {
      settings.clearValidationErrors();
      wiki.providerId = providerId;
      settings.autoSaveProviderSelection(providerId);

      const changeEndTime = Date.now();
      logger.debug(`Provider change completed in ${changeEndTime - changeStartTime}ms`);
    } catch (error) {
      logger.error(`Error changing provider to ${providerId}:`, error);
    }
  };

  const handleApiKeyChange = (providerId: string, newValue: string) => {
    const changeStartTime = Date.now();
    logger.debug(`Updating API key for provider ${providerId}`);

    try {
      const config = providerConfigs.value.find((p) => p.id === providerId);
      if (!config) {
        logger.error(`Provider config not found for ${providerId}`);
        return;
      }

      settings.apiKeyInputs[providerId] = newValue;
      settings.trackApiKeyChange(providerId, newValue);

      const trimmedValue = newValue.trim();
      const originalKey = settings.originalApiKeys[providerId]?.trim() || "";

      if (trimmedValue.length === 0) {
        if (originalKey.length > 0) {
          settings.clearProviderValidationErrors(providerId);
          settings.autoDeleteApiKey(providerId);
        } else {
          settings.clearProviderValidationErrors(providerId);
        }
      } else {
        settings.clearProviderValidationErrors(providerId);
        if (trimmedValue !== originalKey) {
          settings.autoSaveApiKey(providerId, newValue);
        }
      }

      const changeEndTime = Date.now();
      logger.debug(`API key update completed in ${changeEndTime - changeStartTime}ms`);
    } catch (error) {
      logger.error(`Error updating API key for provider ${providerId}:`, error);
    }
  };

  const handleApiKeyFocus = (providerId: string) => {
    const input = settings.apiKeyInputs[providerId] || "";
    const hasSavedKey =
      settings.originalApiKeys[providerId] &&
      settings.originalApiKeys[providerId].length > 0 &&
      input.includes("•");
    if (hasSavedKey) {
      settings.apiKeyInputs[providerId] = settings.originalApiKeys[providerId];
    }
  };

  const handleApiKeyBlur = (providerId: string) => {
    const input = settings.apiKeyInputs[providerId] || "";
    const trimmedInput = input.trim();
    const originalKey = settings.originalApiKeys[providerId]?.trim() || "";

    if (trimmedInput === originalKey) {
      return;
    }

    if (trimmedInput.length === 0) {
      if (originalKey.length > 0) {
        settings.clearProviderValidationErrors(providerId);
        settings.autoDeleteApiKey(providerId);
      } else {
        settings.clearProviderValidationErrors(providerId);
      }
      return;
    }

    const config = providerConfigs.value.find((p) => p.id === providerId);
    if (config) {
      const validationConfig = {
        id: config.id,
        name: config.name || providerId,
        enabled: true,
        apiKey: trimmedInput,
        model: wiki.model,
      };
      validating.value = true;
      lastValidationValid.value = null;
      settings.validateConfiguration(validationConfig, providerId);
      showValidationErrors.value = true;
    }
  };

  const handleCustomFieldChange = (fieldId: string, newValue: string) => {
    settings.saveSetting(fieldId, newValue);
  };

  const openExternalUrl = (url: string) => {
    try {
      vscode.postMessage({
        command: "openExternal",
        payload: { url },
      });
    } catch (error) {
      logger.error("Failed to open external URL:", error);
    }
  };

  return {
    validateCurrentConfiguration,
    handleProviderChange,
    handleApiKeyChange,
    handleApiKeyFocus,
    handleApiKeyBlur,
    handleCustomFieldChange,
    openExternalUrl,
  };
}
