import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    geminiKeyInput: "",
    zaiKeyInput: "",
    saving: false,
    savedMessage: "",
    loading: false,
    initialized: false,
    listenerAttached: false,
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
            const { geminiKey, zaiKey } = message.payload || {};
            this.geminiKeyInput = geminiKey || "";
            this.zaiKeyInput = zaiKey || "";
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
        }
      });

      // Request API keys from the extension
      vscode.postMessage({ command: "getApiKeys" });
    },
    async saveGemini() {
      if (!this.geminiKeyInput) return;
      this.saving = true;
      vscode.postMessage({
        command: "saveApiKey",
        payload: { providerId: "gemini", apiKey: this.geminiKeyInput },
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
  },
});
