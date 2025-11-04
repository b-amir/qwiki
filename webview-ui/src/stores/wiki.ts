import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";
import { useErrorHistoryStore } from "./errorHistory";
import { useLoadingStore } from "./loading";
import { ErrorCodes, getErrorMessage } from "@/utilities/errorMessages";

export type ProviderStatus = { id: string; name: string; hasKey: boolean; models: string[] };

export interface ErrorInfo {
  message: string;
  code?: string;
  suggestions?: string[];
  retryable?: boolean;
  timestamp?: string;
  context?: string;
  originalError?: string;
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
    generateRequestId: null as string | null,
  }),
  actions: {
    init() {
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        const loadingStore = useLoadingStore();
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

            vscode.postMessage({
              command: "frontendLog",
              payload: {
                message: "WikiStore: providers received",
                data: {
                  providerCount: this.providers.length,
                  providersWithKeys: this.providers.filter((p) => p.hasKey).length,
                },
              },
            });

            if (!this.providerId) {
              const selectedProvider = this.providers.find((p) => p.hasKey) || this.providers[0];
              if (selectedProvider) {
                vscode.postMessage({
                  command: "frontendLog",
                  payload: {
                    message: "WikiStore: Setting providerId",
                    data: { providerId: selectedProvider.id, hasKey: selectedProvider.hasKey },
                  },
                });
                this.providerId = selectedProvider.id;
                if (!this.model && selectedProvider.models?.length) {
                  this.model = selectedProvider.models[0];
                }
              } else {
                vscode.postMessage({
                  command: "frontendLog",
                  payload: {
                    message: "WikiStore: No providers available",
                  },
                });
              }
            }
            return;
          }
          case "triggerGenerate": {
            vscode.postMessage({
              command: "frontendLog",
              payload: {
                message: "WikiStore: triggerGenerate received",
                data: { hasSnippet: !!this.snippet?.trim() },
              },
            });
            if (this.snippet?.trim()) {
              this.generate();
            } else {
              this.pendingAutoGenerate = true;
              vscode.postMessage({
                command: "frontendLog",
                payload: {
                  message: "WikiStore: triggerGenerate - no snippet, setting pendingAutoGenerate",
                },
              });
            }
            return;
          }
          case "wikiResult": {
            this.loading = false;
            this.loadingStep = "";
            this.error = "";
            this.errorInfo = null;
            this.content = message.payload?.content || "";
            loadingStore.complete({ context: "wiki" });
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
          case "generationCancelled": {
            this.loading = false;
            this.loadingStep = "";
            this.error = "";
            this.errorInfo = null;
            this.content = "";
            loadingStore.cancel({ context: "wiki", reason: "Generation cancelled" });
            return;
          }
          case "error": {
            const errorCode = message.payload?.code;
            const isCancellation = errorCode === "GENERATION_CANCELLED";

            if (isCancellation) {
              this.loading = false;
              this.loadingStep = "";
              this.error = "";
              this.errorInfo = null;
              this.content = "";
              loadingStore.cancel({ context: "wiki", reason: "Generation cancelled" });
              return;
            }

            this.loading = false;
            this.loadingStep = "";
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

            loadingStore.fail({ context: "wiki", error: this.error });

            return;
          }
          case "loadingStep": {
            if (!this.loading) {
              return;
            }
            this.loadingStep = message.payload?.step || "";
            if (this.loadingStep) {
              loadingStore.advance({ context: "wiki", step: this.loadingStep });
            }
            return;
          }
        }
      };

      window.addEventListener("message", handleMessage);

      vscode.postMessage({ command: "getSelection" });
      vscode.postMessage({ command: "getRelated" });

      setTimeout(() => {
        if (this.loading) {
          this.loading = false;
          this.loadingStep = "";
          const errorInfo = getErrorMessage(ErrorCodes.INIT_TIMEOUT);
          this.error = errorInfo.message;
          this.errorInfo = {
            message: errorInfo.message,
            code: ErrorCodes.INIT_TIMEOUT,
            suggestions: errorInfo.suggestions,
            retryable: true,
            timestamp: new Date().toISOString(),
          };
          useLoadingStore().fail({ context: "wiki", error: this.error });
        }
      }, 30000);
    },
    async generate() {
      vscode.postMessage({
        command: "frontendLog",
        payload: {
          message: "WikiStore: generate() called",
          data: { hasSnippet: !!this.snippet?.trim(), hasProvider: !!this.providerId?.trim() },
        },
      });

      if (!this.snippet?.trim()) {
        vscode.postMessage({
          command: "frontendLog",
          payload: { message: "WikiStore: generate() aborted - missing snippet" },
        });
        const errorInfo = getErrorMessage(ErrorCodes.MISSING_SNIPPET);
        this.error = errorInfo.message;
        this.errorInfo = {
          message: errorInfo.message,
          code: ErrorCodes.MISSING_SNIPPET,
          suggestions: errorInfo.suggestions,
          retryable: false,
          timestamp: new Date().toISOString(),
        };
        return;
      }

      if (!this.providerId?.trim()) {
        vscode.postMessage({
          command: "frontendLog",
          payload: { message: "WikiStore: generate() aborted - no provider selected" },
        });
        const errorInfo = getErrorMessage(ErrorCodes.PROVIDER_NOT_SELECTED);
        this.loading = false;
        this.loadingStep = "";
        this.error = errorInfo.message;
        this.errorInfo = {
          message: errorInfo.message,
          code: ErrorCodes.PROVIDER_NOT_SELECTED,
          suggestions: errorInfo.suggestions,
          retryable: false,
          timestamp: new Date().toISOString(),
        };
        const loadingStore = useLoadingStore();
        loadingStore.fail({ context: "wiki", error: this.error });
        return;
      }

      const loadingStore = useLoadingStore();
      const isLoadingActive = loadingStore.isActive("wiki");

      if (isLoadingActive) {
        vscode.postMessage({
          command: "frontendLog",
          payload: {
            message: "WikiStore: generate() - loading already active, cancelling previous request",
            data: { existingRequestId: this.generateRequestId },
          },
        });

        if (this.generateRequestId) {
          vscode.postMessage({
            command: "cancelWikiGeneration",
            payload: { requestId: this.generateRequestId },
          });
        }

        loadingStore.cancel({ context: "wiki", reason: "New generation requested" });
      }

      vscode.postMessage({
        command: "frontendLog",
        payload: { message: "WikiStore: generate() setting loading state" },
      });

      this.loading = true;
      this.loadingStep = "validating";
      loadingStore.start({ context: "wiki", step: "validating" });
      this.error = "";
      this.errorInfo = null;
      this.content = "";

      this.generateRequestId = Math.random().toString(36).substring(7);

      vscode.postMessage({
        command: "frontendLog",
        payload: {
          message: "WikiStore: generate() sending generateWiki command",
          data: {
            providerId: this.providerId,
            snippetLength: this.snippet.length,
            requestId: this.generateRequestId,
          },
        },
      });

      vscode.postMessage({
        command: "generateWiki",
        payload: {
          providerId: this.providerId,
          model: this.model || undefined,
          snippet: this.snippet,
          languageId: this.languageId || undefined,
          filePath: this.filePath || undefined,
          requestId: this.generateRequestId,
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
      this.pendingAutoGenerate = false;
      this.generateRequestId = null;
      useLoadingStore().reset("wiki");
    },
    cancelPendingActions() {
      const requestId = this.generateRequestId;

      this.loading = false;
      this.loadingStep = "";
      this.pendingAutoGenerate = false;
      this.generateRequestId = null;

      const loadingStore = useLoadingStore();
      if (loadingStore.isActive("wiki")) {
        loadingStore.cancel({ context: "wiki", reason: "User cancelled" });
      }

      this.clearContent();

      if (requestId) {
        vscode.postMessage({
          command: "cancelWikiGeneration",
          payload: { requestId },
        });
      }
    },
    retryGeneration() {
      if (this.errorInfo?.retryable) {
        this.generate();
      }
    },
  },
});
