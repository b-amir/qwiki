import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    zaiKeyInput: "",
    openrouterKeyInput: "",
    googleAIStudioKeyInput: "",
    cohereKeyInput: "",
    huggingfaceKeyInput: "",
    googleAIEndpoint: "openai-compatible", // "openai-compatible" or "native"
    saving: false,
    savedMessage: "",
    loading: false,
    loadingProviders: false,
    initialized: false,
    listenerAttached: false,
    selectedProvider: "zai", // Track selected provider
    // Track original values to detect changes
    originalValues: {
      zaiKey: "",
      openrouterKey: "",
      googleAIStudioKey: "",
      cohereKey: "",
      huggingfaceKey: "",
    },
    // Track which providers have unsaved changes
    unsavedProviders: new Set<string>(),
    // Debounce timers for auto-save
    autoSaveTimers: {} as Record<string, number>,
  }),
  actions: {
    async init() {
      if (this.initialized) return;
      this.loading = true;

      // Set up message listener
      window.addEventListener("message", (event) => {
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
            } = message.payload || {};
            this.zaiKeyInput = zaiKey || "";
            this.openrouterKeyInput = openrouterKey || "";
            this.googleAIStudioKeyInput = googleAIStudioKey || "";
            this.cohereKeyInput = cohereKey || "";
            this.huggingfaceKeyInput = huggingfaceKey || "";
            this.googleAIEndpoint = googleAIEndpoint || "openai-compatible";

            // Store original values to track changes
            this.originalValues.zaiKey = zaiKey || "";
            this.originalValues.openrouterKey = openrouterKey || "";
            this.originalValues.googleAIStudioKey = googleAIStudioKey || "";
            this.originalValues.cohereKey = cohereKey || "";
            this.originalValues.huggingfaceKey = huggingfaceKey || "";

            // Clear unsaved changes since we just loaded from storage
            this.unsavedProviders.clear();

            this.initialized = true;
            this.loading = false;
            return;
          }
          case "apiKeySaved": {
            this.savedMessage = "API key saved successfully";
            setTimeout(() => {
              this.savedMessage = "";
            }, 3000);
            return;
          }
          case "providers": {
            // Set selectedProvider to the first provider with a key, or default to google-ai-studio
            const providers = message.payload || [];
            const withKey = providers.find((p: any) => p.hasKey);

            this.selectedProvider = withKey?.id || "google-ai-studio";
            return;
          }
        }
      });

      // Request API keys from the extension
      vscode.postMessage({ command: "getApiKeys" });
      // Also request providers to set the selected provider
      vscode.postMessage({ command: "getProviders" });
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
    // Track changes to API keys
    trackApiKeyChange(providerId: string, newValue: string) {
      const originalKey =
        this.originalValues[`${providerId}Key` as keyof typeof this.originalValues];

      if (originalKey !== newValue) {
        this.unsavedProviders.add(providerId);
      } else {
        this.unsavedProviders.delete(providerId);
      }
    },
    // Auto-save with debounce for API keys
    autoSaveApiKey(providerId: string, apiKey: string) {
      // Clear any existing timer for this provider
      if (this.autoSaveTimers[providerId]) {
        clearTimeout(this.autoSaveTimers[providerId]);
      }

      // Set a new timer for auto-save (2 seconds delay)
      this.autoSaveTimers[providerId] = window.setTimeout(() => {
        this.saveApiKey(providerId, apiKey);
        delete this.autoSaveTimers[providerId];
      }, 2000);
    },
    // Save a specific API key
    async saveApiKey(providerId: string, apiKey: string) {
      if (!apiKey) return;

      this.saving = true;

      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId, apiKey },
      });

      // Update original value after successful save
      this.originalValues[`${providerId}Key` as keyof typeof this.originalValues] = apiKey;
      this.unsavedProviders.delete(providerId);

      this.saving = false;
    },
    // Global save method that saves all providers with unsaved changes
    async saveAll() {
      if (this.unsavedProviders.size === 0) return;

      this.saving = true;

      // Save each provider with unsaved changes
      const savePromises = Array.from(this.unsavedProviders).map((providerId) => {
        let apiKey = "";

        // Get the current API key for this provider
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

        // Update original value
        this.originalValues[`${providerId}Key` as keyof typeof this.originalValues] = apiKey;

        return Promise.resolve();
      });

      await Promise.all(savePromises);

      // Clear all unsaved changes
      this.unsavedProviders.clear();

      this.saving = false;
    },
    // Auto-save provider selection
    autoSaveProviderSelection(providerId: string) {
      // Provider selection changes are saved immediately
      this.selectedProvider = providerId;
      // No need to save provider selection to extension as it's handled in App.vue
    },
  },
});
