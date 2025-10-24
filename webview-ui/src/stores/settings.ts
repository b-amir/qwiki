import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    geminiKeyInput: "",
    zaiKeyInput: "",
    saving: false,
    savedMessage: "",
  }),
  actions: {
    async saveGemini() {
      if (!this.geminiKeyInput) return;
      this.saving = true;
      vscode.postMessage({ command: "saveApiKey", payload: { providerId: "gemini", apiKey: this.geminiKeyInput } });
      this.savedMessage = "Saved Gemini key";
      this.saving = false;
    },
    async saveZai() {
      if (!this.zaiKeyInput) return;
      this.saving = true;
      vscode.postMessage({ command: "saveApiKey", payload: { providerId: "zai", apiKey: this.zaiKeyInput } });
      this.savedMessage = "Saved Z.ai key";
      this.saving = false;
    },
  },
});

