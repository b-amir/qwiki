import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

export type ProviderStatus = { id: string; name: string; hasKey: boolean; models: string[] };

export interface ErrorInfo {
  message: string;
  code?: string;
  suggestions?: string[];
  retryable?: boolean;
}

export const useWikiStore = defineStore("wiki", {
  state: () => ({
    loading: false as boolean,
    loadingStep: "" as string,
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
    providerId: "" as string,
    model: "" as string,
    pendingAutoGenerate: false as boolean,
    errorInfo: null as ErrorInfo | null,
  }),
  actions: {
    init() {
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        switch (message.command) {
          case "selection": {
            const { text, languageId, filePath } = message.payload || {};
            this.snippet = text || "";
            this.languageId = languageId || "";
            this.filePath = filePath || "";
            vscode.postMessage({ command: "getRelated" });
            if (this.pendingAutoGenerate && this.snippet?.trim()) {
              this.pendingAutoGenerate = false;
              this.generate();
            }
            return;
          }
          case "providers": {
            this.providers = message.payload || [];

            const selectedProvider = this.providers.find((p) => p.hasKey);
            if (selectedProvider) {
              this.providerId = selectedProvider.id;
              if (!this.model && selectedProvider.models?.length) {
                this.model = selectedProvider.models[0];
              }
            }
            return;
          }
          case "triggerGenerate": {
            if (this.snippet?.trim()) {
              this.generate();
            } else {
              this.pendingAutoGenerate = true;
            }
            return;
          }
          case "wikiResult": {
            this.loading = false;
            this.loadingStep = "";
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
            this.loadingStep = "";
            this.error = message.payload?.message || "Unknown error";
            this.errorInfo = {
              message: message.payload?.message || "Unknown error",
              code: message.payload?.code,
              suggestions: message.payload?.suggestions,
              retryable: message.payload?.retryable || false,
            };
            return;
          }
          case "loadingStep": {
            this.loadingStep = message.payload?.step || "";
            return;
          }
        }
      };

      window.addEventListener("message", handleMessage);

      vscode.postMessage({ command: "webviewReady" });
      vscode.postMessage({ command: "getSelection" });
      vscode.postMessage({ command: "getProviders" });
      vscode.postMessage({ command: "getRelated" });

      setTimeout(() => {
        if (this.loading) {
          this.loading = false;
          this.loadingStep = "";
          this.error = "Initialization timeout. Please try again.";
        }
      }, 10000);
    },
    async generate() {
      if (!this.snippet?.trim()) {
        this.error = "No selection. Select some code or text.";
        return;
      }
      this.loading = true;
      this.loadingStep = "validating";
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
      vscode.postMessage({ command: "getRelated" });
    },
    openFile(path: string, line?: number) {
      vscode.postMessage({ command: "openFile", payload: { path, line } });
    },
    clearContent() {
      this.content = "";
      this.error = "";
      this.errorInfo = null;
      this.loadingStep = "";
      this.related = [];
      this.filesSample = [];
      this.overview = "";
    },
    retryGeneration() {
      if (this.errorInfo?.retryable) {
        this.generate();
      }
    },
  },
});
