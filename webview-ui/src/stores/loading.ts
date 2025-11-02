import { defineStore } from "pinia";
import {
  type LoadingAdvanceOptions,
  type LoadingCancelOptions,
  type LoadingCompleteOptions,
  type LoadingContext,
  type LoadingFailOptions,
  type LoadingMessage,
  type LoadingStartOptions,
  type LoadingStateSnapshot,
  KNOWN_CONTEXTS,
  isKnownContext,
} from "@/loading/types";
import { getContextTimeout } from "@/loading/config";
import { getStepsForContext } from "@/loading/stepCatalog";

type TimeoutHandle = ReturnType<typeof setTimeout> | null;

const defaultSnapshot = (): LoadingStateSnapshot => ({
  active: false,
  step: null,
  percent: null,
  startedAt: null,
  timeoutMs: null,
  error: null,
  cancelled: false,
});

export const useLoadingStore = defineStore("loading", {
  state: () => ({
    states: KNOWN_CONTEXTS.reduce<Record<string, LoadingStateSnapshot>>((acc, context) => {
      acc[context] = defaultSnapshot();
      return acc;
    }, {}),
    timers: {} as Record<string, TimeoutHandle>,
  }),
  getters: {
    getState:
      (state) =>
      (context: LoadingContext): LoadingStateSnapshot => {
        if (!state.states[context]) return defaultSnapshot();
        return state.states[context];
      },
    isActive() {
      return (context: LoadingContext) => this.getState(context).active;
    },
  },
  actions: {
    handleMessage(message: LoadingMessage) {
      const percent = typeof message.percent === "number" ? message.percent : null;
      const currentState = this.getState(message.context);

      if (!currentState.active) {
        this.start({ context: message.context, step: message.step });
      } else {
        this.advance({ context: message.context, step: message.step, percent });
      }
    },
    start(options: LoadingStartOptions) {
      const current = this.getState(options.context);
      if (current.active) {
        if (options.step && current.step) {
          if (!this.isStepBefore(options.context, options.step, current.step)) {
            this.advance({ context: options.context, step: options.step });
            return;
          }
        }
      }

      const resolvedTimeout = this.resolveTimeout(options.context, options.timeoutMs ?? null);
      const snapshot: LoadingStateSnapshot = {
        ...defaultSnapshot(),
        active: true,
        step: options.step ?? null,
        startedAt: Date.now(),
        timeoutMs: resolvedTimeout,
      };

      this.setState(options.context, snapshot);
      this.scheduleTimeout(options.context, resolvedTimeout);
    },
    advance(options: LoadingAdvanceOptions) {
      const current = { ...this.ensureState(options.context) };
      if (!current.active) {
        this.start({ context: options.context, step: options.step });
        this.setPercent(options.context, options.percent ?? null);
        return;
      }

      if (current.step && this.isStepBefore(options.context, options.step, current.step)) {
        return;
      }

      current.step = options.step;
      current.percent = this.normalizePercent(options.percent, current.percent);
      current.error = null;
      current.cancelled = false;

      this.setState(options.context, current);
      this.refreshTimeout(options.context);
    },
    isStepBefore(context: LoadingContext, step1: string, step2: string): boolean {
      if (!isKnownContext(context)) {
        return false;
      }

      try {
        const steps = getStepsForContext(context);
        const index1 = steps.findIndex((s) => s.key === step1);
        const index2 = steps.findIndex((s) => s.key === step2);

        if (index1 === -1 || index2 === -1) {
          return false;
        }

        return index1 < index2;
      } catch {
        return false;
      }
    },
    complete(options: LoadingCompleteOptions) {
      const current = { ...this.ensureState(options.context) };
      current.active = false;
      current.percent = current.percent ?? 100;
      current.timeoutMs = null;
      this.setState(options.context, current);
      this.clearTimeout(options.context);
    },
    fail(options: LoadingFailOptions) {
      const current = { ...this.ensureState(options.context) };
      current.active = false;
      current.error = options.error;
      current.timeoutMs = null;
      current.percent = current.percent ?? null;
      current.cancelled = false;
      this.setState(options.context, current);
      this.clearTimeout(options.context);
    },
    cancel(options: LoadingCancelOptions) {
      const current = { ...this.ensureState(options.context) };
      current.active = false;
      current.cancelled = true;
      current.error = options.reason ?? null;
      current.timeoutMs = null;
      this.setState(options.context, current);
      this.clearTimeout(options.context);
    },
    reset(context: LoadingContext) {
      this.setState(context, defaultSnapshot());
      this.clearTimeout(context);
    },
    setPercent(context: LoadingContext, percent: number | null) {
      const current = { ...this.ensureState(context) };
      current.percent = this.normalizePercent(percent, current.percent);
      this.setState(context, current);
    },
    refreshTimeout(context: LoadingContext) {
      const snapshot = this.getState(context);
      if (!snapshot.active || !snapshot.timeoutMs) return;
      this.scheduleTimeout(context, snapshot.timeoutMs);
    },
    resolveTimeout(context: LoadingContext, override: number | null) {
      if (override !== null && override !== undefined) return override;
      if (isKnownContext(context)) {
        return getContextTimeout(context);
      }
      return null;
    },
    scheduleTimeout(context: LoadingContext, timeoutMs: number | null) {
      this.clearTimeout(context);
      if (!timeoutMs) return;

      this.timers[context] = setTimeout(() => {
        // Only fail if still active at timeout.
        if (this.getState(context).active) {
          this.fail({ context, error: "Operation timed out" });
        }
      }, timeoutMs);
    },
    clearTimeout(context: LoadingContext) {
      const handle = this.timers[context];
      if (handle) {
        clearTimeout(handle);
      }
      this.timers[context] = null;
    },
    ensureState(context: LoadingContext): LoadingStateSnapshot {
      if (!this.states[context]) {
        this.states[context] = defaultSnapshot();
      }
      return this.states[context];
    },
    setState(context: LoadingContext, snapshot: LoadingStateSnapshot) {
      this.states[context] = snapshot;
    },
    normalizePercent(nextPercent: number | null | undefined, fallback: number | null) {
      if (typeof nextPercent !== "number") return fallback ?? null;
      if (Number.isNaN(nextPercent)) return fallback ?? null;
      return Math.min(100, Math.max(0, Math.round(nextPercent)));
    },
  },
});

export function isLoadingActive(context: LoadingContext) {
  const store = useLoadingStore();
  return store.isActive(context);
}

export function getLoadingState(context: LoadingContext) {
  const store = useLoadingStore();
  return store.getState(context);
}
