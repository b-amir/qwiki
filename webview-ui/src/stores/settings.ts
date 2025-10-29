import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

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
  }),
  actions: {
    async init() {
      if (this.initialized) return;
      this.loading = true;

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        switch (message.command) {
          case "apiKeys": {
            const { apiKeys = {}, settings = {} } = message.payload || {};
            this.apiKeyInputs = { ...apiKeys };
            this.customSettings = { ...settings };

            this.originalApiKeys = { ...apiKeys };
            this.unsavedProviders.clear();

            this.initialized = true;
            this.loading = false;
            window.removeEventListener("message", handleMessage);
            return;
          }
          case "apiKeySaved": {
            this.savedMessage = "API key saved successfully";
            setTimeout(() => {
              this.savedMessage = "";
            }, 3000);
            return;
          }
          case "settingSaved": {
            this.savedMessage = "Setting saved successfully";
            setTimeout(() => {
              this.savedMessage = "";
            }, 3000);
            return;
          }
          case "providers": {
            const providers = message.payload || [];
            const withKey = providers.find((p: any) => p.hasKey);
            this.selectedProvider = withKey?.id || providers[0]?.id || "";
            return;
          }
          case "configurationValidated": {
            const { isValid, errors = [], warnings = [] } = message.payload || {};
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
            this.savedMessage = "Configuration template applied successfully";
            setTimeout(() => {
              this.savedMessage = "";
            }, 3000);
            return;
          }
          case "configurationBackupCreated": {
            this.savedMessage = "Configuration backup created successfully";
            setTimeout(() => {
              this.savedMessage = "";
            }, 3000);
            return;
          }
          case "providerHealthRetrieved": {
            this.providerHealthStatus = message.payload.healthStatus;
            return;
          }
          case "providerPerformanceRetrieved": {
            this.providerPerformanceStats = message.payload.performanceStats;
            return;
          }
          case "providerCapabilitiesRetrieved": {
            this.providerCapabilities = message.payload.capabilities || {};
            return;
          }
          case "configurationBackupRestored": {
            this.savedMessage = "Configuration backup restored successfully";
            setTimeout(() => {
              this.savedMessage = "";
            }, 3000);
            return;
          }
        }
      };

      window.addEventListener("message", handleMessage);

      vscode.postMessage({ command: "webviewReady" });
      vscode.postMessage({ command: "getApiKeys" });
      vscode.postMessage({ command: "getProviders" });
      vscode.postMessage({ command: "getConfigurationTemplates" });
      vscode.postMessage({ command: "getConfigurationBackups" });

      setTimeout(() => {
        if (this.loading && !this.initialized) {
          this.loading = false;
          window.removeEventListener("message", handleMessage);
        }
      }, 5000);
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
      this.saving = true;
      vscode.postMessage({
        command: "saveSetting",
        payload: { setting, value },
      });
      this.customSettings[setting] = value;
      this.saving = false;
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
      if (!apiKey) return;

      this.saving = true;

      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId, apiKey },
      });

      this.apiKeyInputs[providerId] = apiKey;
      this.originalApiKeys[providerId] = apiKey;
      this.unsavedProviders.delete(providerId);

      this.saving = false;
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
      vscode.postMessage({
        command: "validateConfiguration",
        payload: { providerId, config },
      });
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
      vscode.postMessage({
        command: "getProviderCapabilities",
        payload: {},
      });
    },
    async restoreConfigurationBackup(backupId: string) {
      vscode.postMessage({
        command: "restoreConfigurationBackup",
        payload: { backupId },
      });
    },
  },
});
