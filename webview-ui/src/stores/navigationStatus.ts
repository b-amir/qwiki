import { defineStore } from "pinia";

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
      this.busy = true;
      this.target = target;
      this.startedAt = Date.now();
      this._clearTimeout();
      this.timeoutHandle = setTimeout(() => {
        this.finish(target);
      }, 5000);
    },
    finish(target?: NavigationTarget) {
      if (target && this.target && target !== this.target) {
        return;
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
  },
});
