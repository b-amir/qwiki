import { defineStore } from "pinia";
import { vscode } from "@/utilities/vscode";
import { useLoadingStore } from "@//stores/loading";
import { createLogger } from "@/utilities/logging";

const logger = createLogger("EnvironmentStore");

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
          const oldReady = this.extensionStatus.ready;
          this.extensionStatus = {
            ready: !!payload.extension.ready,
            message: payload.extension.message ?? "",
            reason: payload.extension.reason,
          };
          if (oldReady !== this.extensionStatus.ready) {
            logger.info("Extension ready changed", {
              from: oldReady,
              to: this.extensionStatus.ready,
              message: this.extensionStatus.message,
              reason: this.extensionStatus.reason,
            });
          }
        }

        if (payload?.languageServer) {
          const oldReady = this.languageServerStatus.ready;
          this.languageServerStatus = {
            ready: !!payload.languageServer.ready,
            languageId: payload.languageServer.languageId || "",
            message: payload.languageServer.message ?? "",
            reason: payload.languageServer.reason,
            extensions: Array.isArray(payload.languageServer.extensions)
              ? payload.languageServer.extensions
              : [],
          };
          if (oldReady !== this.languageServerStatus.ready) {
            logger.info("LanguageServer ready changed", {
              from: oldReady,
              to: this.languageServerStatus.ready,
            });
          }
        }

        const wasReady = this.isReady;
        this.syncLoadingState();
        const isNowReady = this.isReady;
        if (wasReady !== isNowReady) {
          logger.info("isReady changed", {
            from: wasReady,
            to: isNowReady,
            extensionReady: this.extensionStatus.ready,
            languageServerReady: this.languageServerStatus.ready,
          });
        }
      };

      window.addEventListener("message", handleMessage);
      vscode.postMessage({ command: "getEnvironmentStatus" });

      this.initialized = true;
      this.syncLoadingState();
    },
    syncLoadingState() {
      const loadingStore = useLoadingStore();
      const steps = this.steps;
      const isReady = this.isReady;
      const currentStep = this.currentStep;

      logger.debug("syncLoadingState called", {
        isReady,
        extensionReady: this.extensionStatus.ready,
        languageServerReady: this.languageServerStatus.ready,
        currentStep,
        loadingActive: loadingStore.getState("environment").active,
      });

      if (!isReady) {
        const current = currentStep || steps[0]?.key || "extensionLoading";
        if (!loadingStore.getState("environment").active) {
          logger.info("Starting environment loading", { step: current });
          loadingStore.start({ context: "environment", step: current });
        } else {
          logger.debug("Advancing environment loading", { step: current });
          loadingStore.advance({ context: "environment", step: current });
        }
      } else {
        if (loadingStore.getState("environment").active) {
          logger.info("Completing environment loading");
          loadingStore.complete({ context: "environment" });
        } else {
          logger.debug("Environment already ready, resetting loading state");
          loadingStore.reset("environment");
        }
      }
    },
  },
});
