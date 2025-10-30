import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";

type EnvironmentStatusPayload = {
  extension?: {
    ready?: boolean;
    message?: string;
    reason?: string;
  };
  languageServer?: {
    ready?: boolean;
    languageId?: string;
    message?: string;
    reason?: string;
    extensions?: string[];
  };
};

export const useEnvironmentStore = defineStore("environment", {
  state: () => ({
    initialized: false,
    extensionStatus: {
      ready: false,
      message: "Preparing Qwiki services...",
      reason: "initializing",
    } as {
      ready: boolean;
      message: string;
      reason?: string;
    },
    languageServerStatus: {
      ready: true,
      languageId: "",
      message: "",
      reason: "unknown",
      extensions: [] as string[],
    } as {
      ready: boolean;
      languageId: string;
      message: string;
      reason?: string;
      extensions: string[];
    },
  }),
  getters: {
    isReady(state) {
      return state.extensionStatus.ready && state.languageServerStatus.ready;
    },
    currentStep(state) {
      if (!state.extensionStatus.ready) {
        return "extensionLoading";
      }
      if (!state.languageServerStatus.ready) {
        return "languageServerLoading";
      }
      return "";
    },
    steps(state) {
      const steps: Array<{ text: string; key: string }> = [];
      if (!state.extensionStatus.ready) {
        steps.push({
          key: "extensionLoading",
          text: state.extensionStatus.message || "Preparing Qwiki services...",
        });
      }
      if (!state.languageServerStatus.ready) {
        steps.push({
          key: "languageServerLoading",
          text:
            state.languageServerStatus.message ||
            `Waiting for ${state.languageServerStatus.languageId || "language"} features...`,
        });
      }
      return steps;
    },
  },
  actions: {
    init() {
      if (this.initialized) {
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        const data = event.data as { command?: string; payload?: EnvironmentStatusPayload };
        if (!data || data.command !== "environmentStatus") {
          return;
        }

        const payload = data.payload;
        if (payload?.extension) {
          this.extensionStatus = {
            ready: !!payload.extension.ready,
            message: payload.extension.message ?? "",
            reason: payload.extension.reason,
          };
        }

        if (payload?.languageServer) {
          this.languageServerStatus = {
            ready: !!payload.languageServer.ready,
            languageId: payload.languageServer.languageId || "",
            message: payload.languageServer.message ?? "",
            reason: payload.languageServer.reason,
            extensions: Array.isArray(payload.languageServer.extensions)
              ? payload.languageServer.extensions
              : [],
          };
        }
      };

      window.addEventListener("message", handleMessage);
      vscode.postMessage({ command: "getEnvironmentStatus" });

      this.initialized = true;
    },
  },
});
