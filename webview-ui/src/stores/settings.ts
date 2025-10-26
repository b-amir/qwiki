import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    geminiKeyInput: "",
    zaiKeyInput: "",
    openrouterKeyInput: "",
    googleAIStudioKeyInput: "",
    cohereKeyInput: "",
    huggingfaceKeyInput: "",
    googleAIEndpoint: "openai-compatible", // "openai-compatible" or "native"
    saving: false,
    savedMessage: "",
    loading: false,
    initialized: false,
    listenerAttached: false,
    selectedProvider: "zai", // Track selected provider
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
              geminiKey,
              zaiKey,
              openrouterKey,
              googleAIStudioKey,
              cohereKey,
              huggingfaceKey,
              googleAIEndpoint,
            } = message.payload || {};
            this.geminiKeyInput = geminiKey || "";
            this.zaiKeyInput = zaiKey || "";
            this.openrouterKeyInput = openrouterKey || "";
            this.googleAIStudioKeyInput = googleAIStudioKey || "";
            this.cohereKeyInput = cohereKey || "";
            this.huggingfaceKeyInput = huggingfaceKey || "";
            this.googleAIEndpoint = googleAIEndpoint || "openai-compatible";
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

            // If user had gemini selected, migrate to google-ai-studio
            if (this.selectedProvider === "gemini") {
              this.selectedProvider = "google-ai-studio";
            } else {
              this.selectedProvider = withKey?.id || "google-ai-studio";
            }
            return;
          }
        }
      });

      // Request API keys from the extension
      vscode.postMessage({ command: "getApiKeys" });
      // Also request providers to set the selected provider
      vscode.postMessage({ command: "getProviders" });
    },
    async saveGemini() {
      if (!this.geminiKeyInput) return;
      this.saving = true;
      // Save as both gemini (for backward compatibility) and google-ai-studio
      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId: "gemini", apiKey: this.geminiKeyInput },
      });
      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId: "google-ai-studio", apiKey: this.geminiKeyInput },
      });
      this.saving = false;
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
  },
});
