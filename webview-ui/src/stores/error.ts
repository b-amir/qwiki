import { defineStore } from "pinia";
import { useErrorHistoryStore } from "./errorHistory";
import { getErrorAction, type ErrorAction } from "@/utilities/errorActions";
import type { PageType } from "./navigation";

export interface ErrorContext {
  page: PageType;
  component?: string;
  operation?: string;
}

export interface ErrorState {
  id: string;
  message: string;
  code?: string;
  category?: string;
  suggestions?: string[];
  retryable?: boolean;
  retryAction?: () => void;
  actions?: ErrorAction[];
  timestamp: string;
  context: ErrorContext;
  originalError?: string;
  severity: "info" | "warning" | "error" | "critical";
}

interface ErrorStoreState {
  currentError: ErrorState | null;
  dismissedErrorIds: Set<string>;
  errorContext: ErrorContext | null;
  isModalOpen: boolean;
}

export const useErrorStore = defineStore("error", {
  state: (): ErrorStoreState => ({
    currentError: null,
    dismissedErrorIds: new Set<string>(),
    errorContext: null,
    isModalOpen: false,
  }),

  actions: {
    setError(errorInput: Partial<ErrorState> & { message: string }): void {
      if (this.currentError) {
        this.archiveError(this.currentError);
      }

      const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      if (this.dismissedErrorIds.has(errorId)) {
        return;
      }

      const category = this.inferCategory(errorInput.code);
      const actions = errorInput.actions || this.getDefaultActions(errorInput.code);

      this.currentError = {
        id: errorId,
        message: errorInput.message,
        code: errorInput.code,
        category: errorInput.category || category,
        suggestions: errorInput.suggestions || [],
        retryable: errorInput.retryable || false,
        retryAction: errorInput.retryAction,
        actions,
        timestamp: new Date().toISOString(),
        context: errorInput.context || this.errorContext || { page: "wiki" },
        originalError: errorInput.originalError,
        severity: errorInput.severity || "error",
      };

      this.isModalOpen = true;
      this.archiveError(this.currentError);
    },

    dismissError(errorId: string): void {
      if (this.currentError?.id === errorId) {
        this.dismissedErrorIds.add(errorId);
        this.currentError = null;
        this.isModalOpen = false;
      }
    },

    clearError(): void {
      if (this.currentError) {
        this.currentError = null;
        this.isModalOpen = false;
      }
    },

    clearPageErrors(page: PageType): void {
      if (this.currentError?.context.page === page) {
        this.clearError();
      }
    },

    onNavigationStart(_targetPage: PageType): void {
      if (this.errorContext) {
        this.clearPageErrors(this.errorContext.page);
      }
    },

    onNavigationComplete(currentPage: PageType): void {
      this.setContext({ page: currentPage });
    },

    setContext(context: ErrorContext): void {
      this.errorContext = context;
    },

    clearContext(): void {
      this.errorContext = null;
    },

    executeAction(action: ErrorAction): void {
      if (action.handler) {
        action.handler();
      }
    },

    retryLastOperation(): void {
      if (this.currentError?.retryable && this.currentError.retryAction) {
        const retryAction = this.currentError.retryAction;
        this.clearError();
        retryAction();
      }
    },

    archiveError(error: ErrorState): void {
      const errorHistory = useErrorHistoryStore();
      errorHistory.addError({
        id: error.id,
        timestamp: error.timestamp,
        message: error.message,
        code: error.code,
        suggestions: error.suggestions,
        retryable: error.retryable,
        context: JSON.stringify(error.context),
        originalError: error.originalError,
      });
    },

    inferCategory(code?: string): string {
      if (!code) return "unknown";

      const categoryMap: Record<string, string> = {
        API_KEY_MISSING: "authentication",
        API_KEY_INVALID: "authentication",
        PROVIDER_NOT_FOUND: "configuration",
        PROVIDER_NOT_SELECTED: "configuration",
        MODEL_NOT_SUPPORTED: "configuration",
        CONFIGURATION_ERROR: "configuration",
        VALIDATION_ERROR: "validation",
        NETWORK_ERROR: "network",
        RATE_LIMIT_EXCEEDED: "network",
        GENERATION_FAILED: "generation",
        MISSING_SNIPPET: "validation",
        INIT_TIMEOUT: "system",
      };

      return categoryMap[code] || "unknown";
    },

    getDefaultActions(errorCode?: string): ErrorAction[] {
      if (!errorCode) {
        return [{ label: "Close", action: "none" }];
      }

      const action = getErrorAction(errorCode);
      if (action) {
        return [action];
      }

      return [{ label: "Close", action: "none" }];
    },
  },
});
