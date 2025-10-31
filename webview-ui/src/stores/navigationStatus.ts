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
    isBackNavigation: false,
  }),
  getters: {
    isNavigating(state) {
      return state.busy;
    },
  },
  actions: {
    start(target: NavigationTarget, isBack: boolean = false) {
      if (this.busy && this.target === target) {
        return;
      }
      const loadingStore = useLoadingStore();
      this.busy = true;
      this.target = target;
      this.isBackNavigation = isBack;
      this.startedAt = Date.now();
      this._clearTimeout();

      if (isBack) {
        loadingStore.start({ context: "navigation", step: "loading" });
        this.timeoutHandle = setTimeout(() => {
          this._handleTimeout(target);
        }, 5000);
      }
    },
    finish(target?: NavigationTarget) {
      const loadingStore = useLoadingStore();
      if (target && this.target && target !== this.target) {
        return;
      }
      if (this.busy && this.isBackNavigation) {
        loadingStore.complete({ context: "navigation" });
      }
      this.busy = false;
      this.target = "";
      this.isBackNavigation = false;
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
