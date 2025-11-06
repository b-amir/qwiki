import type { Ref } from "vue";
import { vscode } from "@/utilities/vscode";
import { createLogger } from "@/utilities/logging";
import type { useSettingsStore } from "@/stores/settings";

export function useSettingsInitialization(
  settings: ReturnType<typeof useSettingsStore>,
  settingsLoading: Ref<boolean>,
) {
  const logger = createLogger("SettingsInitialization");

  const initSettings = async () => {
    const initStartTime = Date.now();
    logger.debug("Starting initialization");

    if (!settings.initialized) {
      settingsLoading.value = true;
      try {
        await settings.init();
        logger.debug("Initialization completed successfully");
      } catch (error) {
        logger.error("Failed to initialize settings:", error);
      } finally {
        settingsLoading.value = false;
      }
    }

    logger.debug("Fetching provider data");
    const providersStartTime = Date.now();

    try {
      vscode.postMessage({ command: "getProviders" });
      vscode.postMessage({ command: "getProviderConfigs" });

      const providersEndTime = Date.now();
      logger.debug(`Provider data requests sent in ${providersEndTime - providersStartTime}ms`);
    } catch (error) {
      logger.error("Error fetching provider data:", error);
    }

    const initEndTime = Date.now();
    logger.debug(`Total initialization time: ${initEndTime - initStartTime}ms`);
  };

  return { initSettings };
}
