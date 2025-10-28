import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    zaiKeyInput: "",
    openrouterKeyInput: "",
    googleAIStudioKeyInput: "",
    cohereKeyInput: "",
    huggingfaceKeyInput: "",
    zaiBaseUrl: "",
    googleAIEndpoint: "openai-compatible",
    saving: false,
    savedMessage: "",
    loading: false,
    loadingProviders: false,
    initialized: false,
    listenerAttached: false,
    selectedProvider: "zai",
    originalValues: {
      zaiKey: "",
      openrouterKey: "",
      googleAIStudioKey: "",
      cohereKey: "",
      huggingfaceKey: "",
      zaiBaseUrl: "",
    },
    unsavedProviders: new Set<string>(),
    autoSaveTimers: {} as Record<string, number>,
  }),
  actions: {
    async init() {
      if (this.initialized) return;
      this.loading = true;

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        switch (message.command) {
          case "apiKeys": {
            const {
              zaiKey,
              openrouterKey,
              googleAIStudioKey,
              cohereKey,
              huggingfaceKey,
              googleAIEndpoint,
              zaiBaseUrl,
            } = message.payload || {};
            this.zaiKeyInput = zaiKey || "";
            this.openrouterKeyInput = openrouterKey || "";
            this.googleAIStudioKeyInput = googleAIStudioKey || "";
            this.cohereKeyInput = cohereKey || "";
            this.huggingfaceKeyInput = huggingfaceKey || "";
            this.zaiBaseUrl = zaiBaseUrl || "";
            this.googleAIEndpoint = googleAIEndpoint || "openai-compatible";

            this.originalValues.zaiKey = zaiKey || "";
            this.originalValues.openrouterKey = openrouterKey || "";
            this.originalValues.googleAIStudioKey = googleAIStudioKey || "";
            this.originalValues.cohereKey = cohereKey || "";
            this.originalValues.huggingfaceKey = huggingfaceKey || "";
            this.originalValues.zaiBaseUrl = zaiBaseUrl || "";

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

            this.selectedProvider = withKey?.id || "google-ai-studio";
            return;
          }
        }
      };

      window.addEventListener("message", handleMessage);

      vscode.postMessage({ command: "webviewReady" });
      vscode.postMessage({ command: "getApiKeys" });
      vscode.postMessage({ command: "getProviders" });

      setTimeout(() => {
        if (this.loading && !this.initialized) {
          this.loading = false;
          window.removeEventListener("message", handleMessage);
        }
      }, 5000);
    },
    async saveZai() {
      if (!this.zaiKeyInput) return;
      this.saving = true;
      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId: "zai", apiKey: this.zaiKeyInput },
      });
      this.saving = false;
    },
    async saveOpenrouter() {
      if (!this.openrouterKeyInput) return;
      this.saving = true;
      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId: "openrouter", apiKey: this.openrouterKeyInput },
      });
      this.saving = false;
    },
    async saveGoogleAIStudio() {
      if (!this.googleAIStudioKeyInput) return;
      this.saving = true;
      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId: "google-ai-studio", apiKey: this.googleAIStudioKeyInput },
      });
      this.saving = false;
    },
    async saveCohere() {
      if (!this.cohereKeyInput) return;
      this.saving = true;
      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId: "cohere", apiKey: this.cohereKeyInput },
      });
      this.saving = false;
    },
    async saveHuggingFace() {
      if (!this.huggingfaceKeyInput) return;
      this.saving = true;
      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId: "huggingface", apiKey: this.huggingfaceKeyInput },
      });
      this.saving = false;
    },
    trackApiKeyChange(providerId: string, newValue: string) {
      const originalKey =
        this.originalValues[`${providerId}Key` as keyof typeof this.originalValues];

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

      this.originalValues[`${providerId}Key` as keyof typeof this.originalValues] = apiKey;
      this.unsavedProviders.delete(providerId);

      this.saving = false;
    },
    async saveAll() {
      if (this.unsavedProviders.size === 0) return;

      this.saving = true;

      const savePromises = Array.from(this.unsavedProviders).map((providerId) => {
        let apiKey = "";

        switch (providerId) {
          case "zai":
            apiKey = this.zaiKeyInput;
            break;
          case "openrouter":
            apiKey = this.openrouterKeyInput;
            break;
          case "google-ai-studio":
            apiKey = this.googleAIStudioKeyInput;
            break;
          case "cohere":
            apiKey = this.cohereKeyInput;
            break;
          case "huggingface":
            apiKey = this.huggingfaceKeyInput;
            break;
        }

        if (!apiKey) return Promise.resolve();

        vscode.postMessage({
          command: "saveApiKey",
          payload: { providerId, apiKey },
        });

        this.originalValues[`${providerId}Key` as keyof typeof this.originalValues] = apiKey;

        return Promise.resolve();
      });

      await Promise.all(savePromises);

      this.unsavedProviders.clear();

      this.saving = false;
    },
    autoSaveProviderSelection(providerId: string) {
      this.selectedProvider = providerId;
    },
  },
});
