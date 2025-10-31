import { defineStore } from "pinia";
import { useLoadingStore } from "./loading";

export type NavigationTarget =
  | ""
  | "wiki"
  | "settings"
  | "errorHistory"
  | "savedWikis"
  | "promptManager"
  | "qualityDashboard"
  | "wikiAggregator";

type TimeoutHandle = ReturnType<typeof setTimeout> | null;

export const useNavigationStatusStore = defineStore("navigationStatus", {
  state: () => ({
    busy: false,
    target: "" as NavigationTarget,
    startedAt: 0,
    timeoutHandle: null as TimeoutHandle,
  }),
  getters: {
    isNavigating(state) {
      return state.busy;
    },
  },
  actions: {
    start(target: NavigationTarget) {
      if (this.busy && this.target === target) {
        return;
      }
      const loadingStore = useLoadingStore();
      this.busy = true;
      this.target = target;
      this.startedAt = Date.now();
      this._clearTimeout();
      loadingStore.start({ context: "navigation", step: "loading" });
      this.timeoutHandle = setTimeout(() => {
        this._handleTimeout(target);
      }, 5000);
    },
    finish(target?: NavigationTarget) {
      const loadingStore = useLoadingStore();
      if (target && this.target && target !== this.target) {
        return;
      }
      if (this.busy) {
        loadingStore.advance({ context: "navigation", step: "preparing" });
        loadingStore.complete({ context: "navigation" });
      }
      this.busy = false;
      this.target = "";
      this.startedAt = 0;
      this._clearTimeout();
    },
    _clearTimeout() {
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = null;
      }
    },
    _handleTimeout(target?: NavigationTarget) {
      if (target && this.target && target !== this.target) {
        return;
      }
      if (!this.busy) {
        return;
      }
      useLoadingStore().fail({ context: "navigation", error: "Navigation timed out" });
      this.busy = false;
      this.target = "";
      this.startedAt = 0;
      this._clearTimeout();
    },
  },
});
