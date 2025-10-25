import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

export type ProviderStatus = { id: string; name: string; hasKey: boolean; models: string[] };

export const useWikiStore = defineStore("wiki", {
  state: () => ({
    loading: false as boolean,
    error: "" as string,
    content: "" as string,
    snippet: "" as string,
    languageId: "" as string,
    filePath: "" as string,
    rootName: "" as string,
    overview: "" as string,
    filesSample: [] as string[],
    related: [] as Array<{ path: string; preview?: string; line?: number; reason?: string }>,
    providers: [] as ProviderStatus[],
    providerId: "gemini" as string,
    model: "" as string,
  }),
  actions: {
    init() {
      window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.command) {
          case "selection": {
            const { text, languageId, filePath } = message.payload || {};
            this.snippet = text || "";
            this.languageId = languageId || "";
            this.filePath = filePath || "";
            // Keep related list in sync with current selection
            vscode.postMessage({ command: "getRelated" });
            return;
          }
          case "providers": {
            this.providers = message.payload || [];
            // Default to first available provider with a key
            const withKey = this.providers.find((p) => p.hasKey)?.id;
            if (withKey) this.providerId = withKey;
            return;
          }
          case "triggerGenerate": {
            this.generate();
            return;
          }
          case "wikiResult": {
            this.loading = false;
            this.error = "";
            this.content = message.payload?.content || "";
            return;
          }
          case "related": {
            const { rootName, overview, filesSample, related } = message.payload || {};
            this.rootName = rootName || "";
            this.overview = overview || "";
            this.filesSample = Array.isArray(filesSample) ? filesSample : [];
            this.related = Array.isArray(related) ? related : [];
            return;
          }
          case "error": {
            this.loading = false;
            this.error = message.payload?.message || "Unknown error";
            return;
          }
        }
      });
      vscode.postMessage({ command: "webviewReady" });
      vscode.postMessage({ command: "getSelection" });
      vscode.postMessage({ command: "getProviders" });
      vscode.postMessage({ command: "getRelated" });
    },
    async generate() {
      if (!this.snippet?.trim()) {
        this.error = "No selection. Select some code or text.";
        return;
      }
      this.loading = true;
      this.error = "";
      this.content = "";
      vscode.postMessage({
        command: "generateWiki",
        payload: {
          providerId: this.providerId,
          model: this.model || undefined,
          snippet: this.snippet,
          languageId: this.languageId || undefined,
          filePath: this.filePath || undefined,
        },
      });
      // Update related files alongside wiki generation
      vscode.postMessage({ command: "getRelated" });
    },
    openFile(path: string, line?: number) {
      vscode.postMessage({ command: "openFile", payload: { path, line } });
    },
  },
});
