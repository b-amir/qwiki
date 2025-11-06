import { nextTick, type Ref } from "vue";
import { createLogger } from "@/utilities/logging";

interface ProviderConfig {
  id: string;
  name: string;
  apiKeyUrl: string;
  apiKeyInput: string;
  additionalInfo?: string;
  hasEndpointType?: boolean;
  modelFallbackIds?: string[];
  defaultModel?: string;
  customFields?: Array<{
    id: string;
    label: string;
    type: "text" | "select";
    placeholder?: string;
    options?: string[];
    defaultValue?: string;
  }>;
}

interface ValidationError {
  field?: string;
  code?: string;
  message: string;
  severity?: string;
}

interface ValidationWarning {
  field?: string;
  code?: string;
  message: string;
}

interface MessageHandlers {
  onProviderConfigs?: (payload: ProviderConfig[]) => void;
  onProviderCapabilities?: (capabilities: Record<string, any>) => void;
  onConfigurationValidated?: (
    isValid: boolean,
    errors: Array<string | ValidationError>,
    warnings: Array<string | ValidationWarning>,
  ) => void;
}

export function useSettingsMessaging(
  centralizedProviderConfigs: Ref<ProviderConfig[]>,
  providerCapabilities: Ref<Record<string, any>>,
  calculateContentHeight: (providerId: string) => void,
  providerConfigs: Ref<ProviderConfig[]>,
  handlers?: MessageHandlers,
) {
  const logger = createLogger("SettingsMessaging");
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  const setupMessageListener = () => {
    if (messageHandler) {
      window.removeEventListener("message", messageHandler);
      messageHandler = null;
    }

    messageHandler = (event: MessageEvent) => {
      const message = event.data;
      const messageStartTime = Date.now();

      try {
        switch (message.command) {
          case "providerConfigs": {
            const payload = message.payload || [];
            logger.debug(`Received ${payload.length} provider configs`);
            if (payload.length > 0 || centralizedProviderConfigs.value.length > 0) {
              centralizedProviderConfigs.value = payload;
            }
            nextTick(() => {
              setTimeout(() => {
                providerConfigs.value.forEach((provider) => {
                  calculateContentHeight(provider.id);
                });
              }, 50);
            });
            handlers?.onProviderConfigs?.(payload);
            break;
          }
          case "providerCapabilitiesRetrieved": {
            const capabilitiesCount = Object.keys(message.payload?.capabilities || {}).length;
            logger.debug(`Received capabilities for ${capabilitiesCount} providers`);
            providerCapabilities.value = message.payload.capabilities || {};
            handlers?.onProviderCapabilities?.(message.payload.capabilities || {});
            break;
          }
          case "configurationValidated": {
            const { isValid, errors = [], warnings = [] } = message.payload || {};
            logger.debug(
              `Configuration validation result - Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`,
            );
            handlers?.onConfigurationValidated?.(!!isValid, errors, warnings);
            break;
          }
        }

        const messageEndTime = Date.now();
        logger.debug(
          `Message ${message.command} processed in ${messageEndTime - messageStartTime}ms`,
        );
      } catch (error) {
        logger.error(`Error processing message ${message.command}:`, error);
      }
    };

    if (messageHandler) {
      window.addEventListener("message", messageHandler);
    }
  };

  const cleanup = () => {
    if (messageHandler) {
      window.removeEventListener("message", messageHandler);
      messageHandler = null;
    }
  };

  return { setupMessageListener, cleanup };
}
