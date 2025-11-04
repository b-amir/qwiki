import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";
import { createLogger } from "@/utilities/logging";
import { useLoadingStore } from "./loading";
import { useErrorHistoryStore } from "./errorHistory";
import { ApiKeyTimings } from "@/constants/apiKeyTimings";

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
    deleteTimers: {} as Record<string, number>,
    pendingApiKeyOperations: {} as Record<string, Promise<"save" | "delete">>,
    savingStates: {} as Record<string, "saving" | "saved" | "error">,
    providersRequiringKeys: [] as string[],
    validationState: {
      isValidating: false,
      lastValidationTime: 0,
      validationCache: {} as Record<string, any>,
    },
    configurationTemplates: [] as any[],
    availableBackups: [] as any[],
    providerHealthStatus: {} as any,
    providerPerformanceStats: {} as any,
    validationErrors: [] as string[],
    validationWarnings: [] as string[],
    providerCapabilities: {} as Record<string, any>,
    providerValidationErrors: {} as Record<
      string,
      Array<{ field?: string; code?: string; message: string; severity?: string }>
    >,
    error: "",
    errorInfo: null as {
      message: string;
      code?: string;
      suggestions?: string[];
      retryable?: boolean;
      timestamp?: string;
      context?: string;
      originalError?: string;
    } | null,
    loadingPhase: {
      providersResolved: false,
      apiKeysResolved: false,
      preparingAnnounced: false,
      completed: false,
    },
    initTimeoutId: undefined as number | undefined,
  }),
  getters: {
    hasAtLeastOneApiKey(): boolean {
      if (this.providersRequiringKeys.length === 0) {
        return true;
      }

      const allKeys = { ...this.originalApiKeys, ...this.apiKeyInputs };
      return this.providersRequiringKeys.some((id) => {
        const key = allKeys[id];
        return key && key.trim().length > 0;
      });
    },
  },
  actions: {
    async init() {
      if (this.initialized) return;
      if (this.loading) {
        logger.debug("Initialization already in progress, skipping");
        return;
      }

      if (this.initTimeoutId) {
        clearTimeout(this.initTimeoutId);
        this.initTimeoutId = undefined;
      }

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

              if (settings?.selectedProvider && !this.selectedProvider) {
                this.selectedProvider = settings.selectedProvider;
              }

              this.originalApiKeys = { ...apiKeys };
              this.unsavedProviders.clear();

              this.initialized = true;
              this.loading = false;
              this.loadingPhase.apiKeysResolved = true;

              if (this.initTimeoutId) {
                clearTimeout(this.initTimeoutId);
                this.initTimeoutId = undefined;
              }

              this.ensurePreparingPhase(loadingStore);
              this.tryCompleteLoading(loadingStore);
              try {
                vscode.postMessage({
                  command: "frontendLog",
                  payload: { message: "Settings Store: Initialization completed, loading=false" },
                });
              } catch {}
              if (this.loadingPhase.completed) {
                const initEndTime = Date.now();
                logger.debug(`Initialization completed in ${initEndTime - initStartTime}ms`);
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
            case "apiKeyDeleted": {
              const providerId = message.payload?.providerId;
              if (providerId) {
                logger.debug(`API key deleted for provider ${providerId}`);
                delete this.originalApiKeys[providerId];
                delete this.apiKeyInputs[providerId];
                this.unsavedProviders.delete(providerId);
                delete this.autoSaveTimers[providerId];

                try {
                  vscode.postMessage({ command: "getProviders" });
                  vscode.postMessage({ command: "getApiKeys" });
                } catch {}
              }
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

              if (!this.selectedProvider && providers.length > 0) {
                const withKey = providers.find((p: any) => p.hasKey);
                this.selectedProvider = withKey?.id || providers[0]?.id || "google-ai-studio";
              }

              this.updateProvidersRequiringKeys(providers);

              this.loadingPhase.providersResolved = true;
              this.ensurePreparingPhase(loadingStore);
              this.tryCompleteLoading(loadingStore);
              if (this.loadingPhase.completed && this.initialized) {
                if (this.initTimeoutId) {
                  clearTimeout(this.initTimeoutId);
                  this.initTimeoutId = undefined;
                }
                const initEndTime = Date.now();
                logger.debug(`Initialization completed in ${initEndTime - initStartTime}ms`);
              }
              return;
            }
            case "configurationValidated": {
              const { isValid, errors = [], warnings = [], providerId } = message.payload || {};
              logger.debug(
                `Configuration validation - Provider: ${providerId}, Valid: ${isValid}, Errors: ${errors.length}, Warnings: ${warnings.length}`,
              );

              if (providerId) {
                const formattedErrors = errors.map((e: any) => {
                  if (typeof e === "string") return { message: e, severity: "error" };
                  return {
                    field: e?.field,
                    code: e?.code,
                    message: e?.message || e?.error || JSON.stringify(e),
                    severity: e?.severity || "error",
                  };
                });
                this.providerValidationErrors[providerId] = formattedErrors;
              }

              this.savedMessage = isValid
                ? "Configuration is valid"
                : `Configuration validation failed: ${errors.join(", ")}`;
              this.validationErrors = errors;
              this.validationWarnings = warnings;
              setTimeout(() => {
                this.savedMessage = "";
                if (!providerId) {
                  this.validationErrors = [];
                  this.validationWarnings = [];
                }
              }, 5000);
              return;
            }
            case "configurationTemplates": {
              const templates = message.payload?.templates || [];
              logger.debug(`Received ${templates.length} configuration templates`);
              this.configurationTemplates = templates;
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
            case "configurationBackups": {
              const backups = message.payload?.backups || [];
              logger.debug(`Received ${backups.length} configuration backups`);
              this.availableBackups = backups;
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
              logger.debug(`Retrieved provider health - ${healthyCount} healthy providers`);
              this.providerHealthStatus = healthStatus;
              return;
            }
            case "providerPerformanceRetrieved": {
              const performanceStats = message.payload.performanceStats;
              const providerCount = Object.keys(performanceStats).length;
              logger.debug(`Retrieved performance stats for ${providerCount} providers`);
              this.providerPerformanceStats = performanceStats;
              return;
            }
            case "providerCapabilitiesRetrieved": {
              const capabilities = message.payload.capabilities || {};
              const providerCount = Object.keys(capabilities).length;
              logger.debug(`Retrieved capabilities for ${providerCount} providers`);
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
            case "error": {
              const errorCode = message.payload?.code;
              logger.debug(`Error received in settings store: ${errorCode}`, {
                message: message.payload?.message,
                hasSuggestions: !!(message.payload?.suggestions || message.payload?.suggestion),
              });

              this.error = message.payload?.message || "Unknown error";
              const suggestions =
                message.payload?.suggestions ||
                (message.payload?.suggestion ? [message.payload.suggestion] : undefined);
              this.errorInfo = {
                message: message.payload?.message || "Unknown error",
                code: message.payload?.code,
                suggestions,
                retryable: message.payload?.retryable || false,
                timestamp: message.payload?.timestamp,
                context: message.payload?.context,
                originalError: message.payload?.originalError,
              };

              const errorHistory = useErrorHistoryStore();
              errorHistory.addError({
                ...this.errorInfo,
                timestamp: message.payload?.timestamp || new Date().toISOString(),
              });

              logger.debug(`Error set in settings store: ${this.error}`);

              return;
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

      if (!this.listenerAttached) {
        window.addEventListener("message", handleMessage);
        this.listenerAttached = true;
        logger.debug("Message listener attached");
      } else {
        logger.debug("Message listener already attached, skipping");
      }
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

      this.initTimeoutId = window.setTimeout(() => {
        if (this.loading && !this.initialized) {
          logger.debug("Initialization taking longer than expected, retrying commands", {
            initialized: this.initialized,
            loading: this.loading,
            apiKeysResolved: this.loadingPhase.apiKeysResolved,
            providersResolved: this.loadingPhase.providersResolved,
          });

          try {
            vscode.postMessage({ command: "getApiKeys" });
            vscode.postMessage({ command: "getProviders" });
            logger.debug("Retried initialization commands");
          } catch (error) {
            logger.error("Error retrying initialization commands:", error);
          }

          this.initTimeoutId = window.setTimeout(() => {
            if (this.loading && !this.initialized) {
              logger.error("Initialization timeout - settings not loaded within 45 seconds");
              this.loading = false;
              this.initTimeoutId = undefined;
              loadingStore.fail({
                context: "settings",
                error: "Settings initialization timed out",
              });
            } else {
              this.initTimeoutId = undefined;
            }
          }, 15000);
        } else {
          this.initTimeoutId = undefined;
        }
      }, 45000);
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
        logger.debug(`Setting ${setting} saved in ${saveEndTime - saveStartTime}ms`);
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

      const hasErrors = this.providerValidationErrors[providerId]?.some(
        (e) => e.severity === "error",
      );
      if (hasErrors) {
        logger.debug(`Skipping auto-save for ${providerId} due to validation errors`);
        return;
      }

      this.autoSaveTimers[providerId] = window.setTimeout(() => {
        const savePromise = this.saveApiKey(providerId, apiKey);
        this.pendingApiKeyOperations[providerId] = savePromise.then(() => "save" as const);
        delete this.autoSaveTimers[providerId];
      }, ApiKeyTimings.saveDebounceDelay);
    },
    async saveApiKey(providerId: string, apiKey: string) {
      const trimmedKey = apiKey?.trim() || "";
      const originalKey = this.originalApiKeys[providerId]?.trim() || "";

      if (trimmedKey === originalKey) {
        logger.debug(`Skipping save for ${providerId} - value unchanged`);
        return;
      }

      const hadOriginalKey = Boolean(originalKey.length > 0);

      if (!trimmedKey) {
        if (hadOriginalKey) {
          logger.debug(`API key cleared for provider ${providerId}, deleting saved key`);
          await this.deleteApiKey(providerId);
        } else {
          logger.warn(`Attempted to save empty API key for provider ${providerId}`);
        }
        return;
      }

      const hasErrors = this.providerValidationErrors[providerId]?.some(
        (e) => e.severity === "error",
      );
      if (hasErrors) {
        logger.warn(`Prevented saving API key for ${providerId} due to validation errors`);
        this.savingStates[providerId] = "error";
        return;
      }

      const saveStartTime = Date.now();
      logger.debug(`Saving API key for provider ${providerId}`);
      this.savingStates[providerId] = "saving";

      try {
        this.saving = true;

        vscode.postMessage({
          command: "saveApiKey",
          payload: { providerId, apiKey: trimmedKey },
        });

        this.apiKeyInputs[providerId] = trimmedKey;
        this.originalApiKeys[providerId] = trimmedKey;
        this.unsavedProviders.delete(providerId);
        this.savingStates[providerId] = "saved";

        setTimeout(() => {
          delete this.savingStates[providerId];
        }, 2000);

        const saveEndTime = Date.now();
        logger.debug(
          `API key for provider ${providerId} saved in ${saveEndTime - saveStartTime}ms`,
        );
      } catch (error) {
        logger.error(`Error saving API key for provider ${providerId}:`, error);
        this.savingStates[providerId] = "error";
        setTimeout(() => {
          delete this.savingStates[providerId];
        }, 3000);
      } finally {
        this.saving = false;
        delete this.pendingApiKeyOperations[providerId];
      }
    },
    autoDeleteApiKey(providerId: string) {
      if (this.deleteTimers[providerId]) {
        clearTimeout(this.deleteTimers[providerId]);
      }

      if (this.autoSaveTimers[providerId]) {
        clearTimeout(this.autoSaveTimers[providerId]);
        delete this.autoSaveTimers[providerId];
      }

      this.deleteTimers[providerId] = window.setTimeout(() => {
        const deletePromise = this.deleteApiKey(providerId);
        this.pendingApiKeyOperations[providerId] = deletePromise.then(() => "delete" as const);
        delete this.deleteTimers[providerId];
      }, ApiKeyTimings.deleteDebounceDelay);
    },
    async deleteApiKey(providerId: string) {
      const hadOriginalKey = Boolean(
        this.originalApiKeys[providerId] && this.originalApiKeys[providerId].trim().length > 0,
      );

      if (!hadOriginalKey) {
        logger.debug(`No API key to delete for provider ${providerId}`);
        return;
      }

      const deleteStartTime = Date.now();
      logger.debug(`Deleting API key for provider ${providerId}`);

      try {
        this.saving = true;
        this.savingStates[providerId] = "saving";

        vscode.postMessage({
          command: "deleteApiKey",
          payload: { providerId },
        });

        delete this.apiKeyInputs[providerId];
        delete this.originalApiKeys[providerId];
        this.unsavedProviders.delete(providerId);
        delete this.autoSaveTimers[providerId];
        delete this.savingStates[providerId];

        const deleteEndTime = Date.now();
        logger.debug(
          `API key for provider ${providerId} deleted in ${deleteEndTime - deleteStartTime}ms`,
        );
      } catch (error) {
        logger.error(`Error deleting API key for provider ${providerId}:`, error);
        this.savingStates[providerId] = "error";
        setTimeout(() => {
          delete this.savingStates[providerId];
        }, 3000);
      } finally {
        this.saving = false;
        delete this.pendingApiKeyOperations[providerId];
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
      logger.debug(`Validating configuration for provider ${providerId || "unknown"}`);

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
        logger.error(`Error validating configuration for provider ${providerId}:`, error);
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
    clearError() {
      this.error = "";
      this.errorInfo = null;
    },
    clearProviderValidationErrors(providerId: string) {
      delete this.providerValidationErrors[providerId];
    },
    clearValidationErrors() {
      this.validationErrors = [];
      this.validationWarnings = [];
      this.providerValidationErrors = {};
      this.validationState.isValidating = false;
    },
    shouldRevalidate(providerId: string): boolean {
      const cacheKey = `${providerId}:${this.apiKeyInputs[providerId] || ""}`;
      const cached = this.validationState.validationCache[cacheKey];
      if (!cached) return true;

      const cacheAge = Date.now() - cached.timestamp;
      return cacheAge > ApiKeyTimings.validationCacheTTL;
    },
    async waitForPendingOperations(
      maxWaitMs: number = ApiKeyTimings.pendingOperationsMaxWait,
    ): Promise<void> {
      const operationPromises = Object.values(this.pendingApiKeyOperations);
      if (operationPromises.length === 0) {
        return;
      }

      try {
        await Promise.race([
          Promise.all(operationPromises),
          new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs)),
        ]);
      } catch (error) {
        logger.error("Error waiting for pending operations:", error);
      }
    },
    getProvidersRequiringKeys(): string[] {
      return this.providersRequiringKeys;
    },
    updateProvidersRequiringKeys(providers: any[]): void {
      this.providersRequiringKeys = providers
        .filter((p: any) => p.requiresApiKey !== false)
        .map((p: any) => p.id);
    },
    checkAllApiKeysStatus(): Record<string, boolean> {
      const allKeys = { ...this.originalApiKeys, ...this.apiKeyInputs };
      const status: Record<string, boolean> = {};

      for (const providerId of this.providersRequiringKeys) {
        const key = allKeys[providerId];
        status[providerId] = Boolean(key && key.trim().length > 0);
      }

      return status;
    },
    clearAllTimers() {
      for (const timerId of Object.values(this.autoSaveTimers)) {
        clearTimeout(timerId);
      }
      for (const timerId of Object.values(this.deleteTimers)) {
        clearTimeout(timerId);
      }
      this.autoSaveTimers = {};
      this.deleteTimers = {};
    },
    cancelPendingActions() {
      this.loading = false;
      this.loadingProviders = false;
      this.saving = false;
      this.savedMessage = "";
      this.validationErrors = [];
      this.validationWarnings = [];
      this.error = "";
      this.errorInfo = null;

      this.clearAllTimers();

      if (this.initTimeoutId) {
        clearTimeout(this.initTimeoutId);
        this.initTimeoutId = undefined;
      }

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
