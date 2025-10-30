import { defineStore } from "pinia";

export interface ErrorHistoryEntry {
  id?: string;
  timestamp: string;
  message: string;
  code?: string;
  suggestions?: string[];
  retryable?: boolean;
  context?: string;
}

export const useErrorHistoryStore = defineStore("errorHistory", {
  state: () => ({
    errors: [] as ErrorHistoryEntry[],
    maxErrors: 50,
  }),

  actions: {
    addError(error: ErrorHistoryEntry) {
      if (!error.id) {
        error.id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      this.errors.unshift(error);

      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(0, this.maxErrors);
      }

      console.error("[QWIKI]", `Error added to history: ${error.code}`, error);
    },

    clearErrors() {
      this.errors = [];
      console.log("[QWIKI]", "Error history cleared");
    },

    removeError(id: string) {
      const index = this.errors.findIndex((error) => error.id === id);
      if (index !== -1) {
        this.errors.splice(index, 1);
        console.log("[QWIKI]", `Error removed from history: ${id}`);
      }
    },

    getErrorCount(): number {
      return this.errors.length;
    },

    getErrorsByCode(code: string): ErrorHistoryEntry[] {
      return this.errors.filter((error) => error.code === code);
    },
  },
});
