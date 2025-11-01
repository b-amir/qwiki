import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";
import { createLogger } from "@/utilities/logging";
import { useLoadingStore } from "./loading";

const logger = createLogger("SettingsStore");

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    apiKeyInputs: {} as Record<string, string>,
    customSettings: {} as Record<string, string>,
    saving: false,
    savedMessage: "",
    loading: false,
    loadingProviders: false,
    initialized: false,
    listenerAttached: false,
    selectedProvider: "",
    originalApiKeys: {} as Record<string, string>,
    unsavedProviders: new Set<string>(),
    autoSaveTimers: {} as Record<string, number>,
    configurationTemplates: [] as any[],
    availableBackups: [] as any[],
    providerHealthStatus: {} as any,
    providerPerformanceStats: {} as any,
    validationErrors: [] as string[],
    validationWarnings: [] as string[],
    providerCapabilities: {} as Record<string, any>,
    loadingPhase: {
      providersResolved: false,
      apiKeysResolved: false,
      preparingAnnounced: false,
      completed: false,
    },
  }),
  actions: {
    async init() {
      if (this.initialized) return;
      const initStartTime = Date.now();
      logger.debug("Starting initialization");
      this.loadingPhase = {
        providersResolved: false,
        apiKeysResolved: false,
        preparingAnnounced: false,
        completed: false,
      };
      try {
        vscode.postMessage({
          command: "frontendLog",
          payload: { message: "Settings Store: Starting initialization" },
        });
      } catch {}

      this.loading = true;
      const loadingStore = useLoadingStore();
      loadingStore.start({ context: "settings", step: "loading" });

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        const messageStartTime = Date.now();

        try {
          switch (message.command) {
            case "apiKeys": {
              logger.debug("Received API keys data");
              try {
                vscode.postMessage({
                  command: "frontendLog",
                  payload: {
                    message: "Settings Store: Received API keys data",
                    data: {
                      keys: Object.keys((message.payload || {}).apiKeys || {}).length,
                    },
                  },
                });
              } catch {}
              const { apiKeys = {}, settings = {} } = message.payload || {};
              this.apiKeyInputs = { ...apiKeys };
              this.customSettings = { ...settings };

              this.originalApiKeys = { ...apiKeys };
              this.unsavedProviders.clear();

              this.initialized = true;
              this.loading = false;
              this.loadingPhase.apiKeysResolved = true;
              this.ensurePreparingPhase(loadingStore);
              this.tryCompleteLoading(loadingStore);
              try {
                vscode.postMessage({
                  command: "frontendLog",
                  payload: { message: "Settings Store: Initialization completed, loading=false" },
                });
              } catch {}
              if (this.loadingPhase.completed) {
                window.removeEventListener("message", handleMessage);

                const initEndTime = Date.now();
                logger.debug(
                  `Initialization completed in ${initEndTime - initStartTime}ms`,
                );
              }
              return;
            }
            case "apiKeySaved": {
              logger.debug("API key saved successfully");
              this.savedMessage = "API key saved successfully";
              setTimeout(() => {
                this.savedMessage = "";
              }, 3000);

              try {
                vscode.postMessage({ command: "getProviders" });
                vscode.postMessage({ command: "getApiKeys" });
              } catch {}
              return;
            }
            case "settingSaved": {
              logger.debug("Setting saved successfully");
              this.savedMessage = "Setting saved successfully";
              setTimeout(() => {
                this.savedMessage = "";
              }, 3000);
              return;
            }
            case "providers": {
              const providers = message.payload || [];
              logger.debug(`Received ${providers.length} providers`);
              const withKey = providers.find((p: any) => p.hasKey);
              this.selectedProvider = withKey?.id || providers[0]?.id || "";
              this.loadingPhase.providersResolved = true;
              this.ensurePreparingPhase(loadingStore);
              this.tryCompleteLoading(loadingStore);
              if (this.loadingPhase.completed) {
                window.removeEventListener("message", handleMessage);
                const initEndTime = Date.now();
                logger.debug(
                  `Initialization completed in ${initEndTime - initStartTime}ms`,
                );
              }
              return;
            }
            case "configurationValidated": {
              const { isValid, errors = [], warnings = [] } = message.payload || {};
              logger.debug(
                `Configuration validation - Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`,
              );
              this.savedMessage = isValid
                ? "Configuration is valid"
                : `Configuration validation failed: ${errors.join(", ")}`;
              this.validationErrors = errors;
              this.validationWarnings = warnings;
              setTimeout(() => {
                this.savedMessage = "";
                this.validationErrors = [];
                this.validationWarnings = [];
              }, 5000);
              return;
            }
            case "configurationTemplateApplied": {
              logger.debug("Configuration template applied successfully");
              this.savedMessage = "Configuration template applied successfully";
              setTimeout(() => {
                this.savedMessage = "";
              }, 3000);
              return;
            }
            case "configurationBackupCreated": {
              logger.debug("Configuration backup created successfully");
              this.savedMessage = "Configuration backup created successfully";
              setTimeout(() => {
                this.savedMessage = "";
              }, 3000);
              return;
            }
            case "providerHealthRetrieved": {
              const healthStatus = message.payload.healthStatus;
              const healthyCount = Object.values(healthStatus).filter(
                (status: any) => status.isHealthy,
              ).length;
              logger.debug(
                `Retrieved provider health - ${healthyCount} healthy providers`,
              );
              this.providerHealthStatus = healthStatus;
              return;
            }
            case "providerPerformanceRetrieved": {
              const performanceStats = message.payload.performanceStats;
              const providerCount = Object.keys(performanceStats).length;
              logger.debug(
                `Retrieved performance stats for ${providerCount} providers`,
              );
              this.providerPerformanceStats = performanceStats;
              return;
            }
            case "providerCapabilitiesRetrieved": {
              const capabilities = message.payload.capabilities || {};
              const providerCount = Object.keys(capabilities).length;
              logger.debug(
                `Retrieved capabilities for ${providerCount} providers`,
              );
              this.providerCapabilities = capabilities;
              return;
            }
            case "configurationBackupRestored": {
              logger.debug("Configuration backup restored successfully");
              this.savedMessage = "Configuration backup restored successfully";
              setTimeout(() => {
                this.savedMessage = "";
              }, 3000);
              return;
            }
          }

          const messageEndTime = Date.now();
          logger.debug(
            `Message ${message.command} processed in ${messageEndTime - messageStartTime}ms`,
          );
        } catch (error) {
          logger.error(
            `Error processing message ${message.command}:`,
            error,
          );
        }
      };

      window.addEventListener("message", handleMessage);
      logger.debug("Message listener attached");
      try {
        vscode.postMessage({
          command: "frontendLog",
          payload: { message: "Settings Store: Message listener attached" },
        });
      } catch {}

      try {
        logger.debug("Sending initialization messages");
        vscode.postMessage({ command: "webviewReady" });
        vscode.postMessage({ command: "getApiKeys" });
        vscode.postMessage({ command: "getProviders" });
        vscode.postMessage({ command: "getConfigurationTemplates" });
        vscode.postMessage({ command: "getConfigurationBackups" });
        loadingStore.advance({ context: "settings", step: "fetching" });
      } catch (error) {
        logger.error("Error sending initialization messages:", error);
      }

      setTimeout(() => {
        if (this.loading && !this.initialized) {
          logger.error(
            "Initialization timeout - settings not loaded within 5 seconds",
          );
          this.loading = false;
          window.removeEventListener("message", handleMessage);
          loadingStore.fail({ context: "settings", error: "Settings initialization timed out" });
        }
      }, 5000);
    },
    ensurePreparingPhase(loadingStore: ReturnType<typeof useLoadingStore>) {
      if (
        this.loadingPhase.providersResolved &&
        this.loadingPhase.apiKeysResolved &&
        !this.loadingPhase.preparingAnnounced
      ) {
        loadingStore.advance({ context: "settings", step: "preparing" });
        this.loadingPhase.preparingAnnounced = true;
      }
    },
    tryCompleteLoading(loadingStore: ReturnType<typeof useLoadingStore>) {
      if (this.loadingPhase.completed) return;

      const bothResolved = this.loadingPhase.providersResolved && this.loadingPhase.apiKeysResolved;
      if (!bothResolved) return;

      if (!this.loadingPhase.preparingAnnounced) {
        loadingStore.advance({ context: "settings", step: "preparing" });
        this.loadingPhase.preparingAnnounced = true;
        setTimeout(() => {
          if (!this.loadingPhase.completed) {
            loadingStore.complete({ context: "settings" });
            this.loadingPhase.completed = true;
          }
        }, 80);
        return;
      }

      loadingStore.complete({ context: "settings" });
      this.loadingPhase.completed = true;
    },
    trackApiKeyChange(providerId: string, newValue: string) {
      const originalKey = this.originalApiKeys[providerId];

      if (originalKey !== newValue) {
        this.unsavedProviders.add(providerId);
      } else {
        this.unsavedProviders.delete(providerId);
      }
    },
    async saveSetting(setting: string, value: string) {
      const saveStartTime = Date.now();
      logger.debug(`Saving setting ${setting}`);

      try {
        this.saving = true;
        vscode.postMessage({
          command: "saveSetting",
          payload: { setting, value },
        });
        this.customSettings[setting] = value;

        const saveEndTime = Date.now();
        logger.debug(
          `Setting ${setting} saved in ${saveEndTime - saveStartTime}ms`,
        );
      } catch (error) {
        logger.error(`Error saving setting ${setting}:`, error);
      } finally {
        this.saving = false;
      }
    },
    autoSaveApiKey(providerId: string, apiKey: string) {
      if (this.autoSaveTimers[providerId]) {
        clearTimeout(this.autoSaveTimers[providerId]);
      }

      this.autoSaveTimers[providerId] = window.setTimeout(() => {
        this.saveApiKey(providerId, apiKey);
        delete this.autoSaveTimers[providerId];
      }, 2000);
    },
    async saveApiKey(providerId: string, apiKey: string) {
      if (!apiKey) {
        logger.warn(
          `Attempted to save empty API key for provider ${providerId}`,
        );
        return;
      }

      const saveStartTime = Date.now();
      logger.debug(`Saving API key for provider ${providerId}`);

      try {
        this.saving = true;

        vscode.postMessage({
          command: "saveApiKey",
          payload: { providerId, apiKey },
        });

        this.apiKeyInputs[providerId] = apiKey;
        this.originalApiKeys[providerId] = apiKey;
        this.unsavedProviders.delete(providerId);

        const saveEndTime = Date.now();
        logger.debug(
          `API key for provider ${providerId} saved in ${saveEndTime - saveStartTime}ms`,
        );
      } catch (error) {
        logger.error(
          `Error saving API key for provider ${providerId}:`,
          error,
        );
      } finally {
        this.saving = false;
      }
    },
    async saveAll() {
      if (this.unsavedProviders.size === 0) return;

      this.saving = true;

      const savePromises = Array.from(this.unsavedProviders).map((providerId) => {
        const apiKey = this.apiKeyInputs[providerId];
        if (!apiKey) return Promise.resolve();

        vscode.postMessage({
          command: "saveApiKey",
          payload: { providerId, apiKey },
        });

        this.originalApiKeys[providerId] = apiKey;

        return Promise.resolve();
      });

      await Promise.all(savePromises);

      this.unsavedProviders.clear();

      this.saving = false;
    },
    autoSaveProviderSelection(providerId: string) {
      this.selectedProvider = providerId;
    },
    async validateConfiguration(config: any, providerId?: string) {
      const validationStartTime = Date.now();
      logger.debug(
        `Validating configuration for provider ${providerId || "unknown"}`,
      );

      try {
        vscode.postMessage({
          command: "validateConfiguration",
          payload: { providerId, config },
        });

        const validationEndTime = Date.now();
        logger.debug(
          `Configuration validation request sent in ${validationEndTime - validationStartTime}ms`,
        );
      } catch (error) {
        logger.error(
          `Error validating configuration for provider ${providerId}:`,
          error,
        );
      }
    },
    async applyConfigurationTemplate(templateId: string) {
      vscode.postMessage({
        command: "applyConfigurationTemplate",
        payload: { templateId },
      });
    },
    async createConfigurationBackup(description?: string) {
      vscode.postMessage({
        command: "createConfigurationBackup",
        payload: { description },
      });
    },
    async getProviderHealth(providerId: string) {
      vscode.postMessage({
        command: "getProviderHealth",
        payload: { providerId },
      });
    },
    async getProviderPerformance(providerId: string) {
      vscode.postMessage({
        command: "getProviderPerformance",
        payload: { providerId },
      });
    },
    async getProviderCapabilities() {
      const capabilitiesStartTime = Date.now();
      logger.debug("Requesting provider capabilities");

      try {
        vscode.postMessage({
          command: "getProviderCapabilities",
          payload: {},
        });

        const capabilitiesEndTime = Date.now();
        logger.debug(
          `Provider capabilities request sent in ${capabilitiesEndTime - capabilitiesStartTime}ms`,
        );
      } catch (error) {
        logger.error("Error requesting provider capabilities:", error);
      }
    },
    async restoreConfigurationBackup(backupId: string) {
      vscode.postMessage({
        command: "restoreConfigurationBackup",
        payload: { backupId },
      });
    },
    cancelPendingActions() {
      this.loading = false;
      this.loadingProviders = false;
      this.saving = false;
      this.savedMessage = "";
      this.validationErrors = [];
      this.validationWarnings = [];

      this.loadingPhase = {
        providersResolved: false,
        apiKeysResolved: false,
        preparingAnnounced: false,
        completed: false,
      };

      useLoadingStore().reset("settings");
    },
  },
});
