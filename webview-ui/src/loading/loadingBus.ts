import { useLoadingStore } from "@/stores/loading";
import type { LoadingContext, LoadingMessage } from "@/loading/types";

let initialized = false;
let cleanupFn: (() => void) | null = null;

export function initializeLoadingBus(targetWindow: Window = window) {
  if (initialized) return cleanupFn;

  const store = useLoadingStore();

  const handler = (event: MessageEvent) => {
    const data = event.data as { command?: string; payload?: unknown };
    if (!data || data.command !== "loadingStep") return;

    const normalized = normalizePayload(data.payload);
    if (!normalized) return;

    store.handleMessage(normalized);
  };

  targetWindow.addEventListener("message", handler);
  initialized = true;
  cleanupFn = () => {
    targetWindow.removeEventListener("message", handler);
    initialized = false;
    cleanupFn = null;
  };

  return cleanupFn;
}

function normalizePayload(payload: unknown): LoadingMessage | null {
  if (!payload || typeof payload !== "object" || payload === null) return null;
  const payloadObj = payload as Record<string, unknown>;
  const maybeStep = payloadObj.step;
  if (typeof maybeStep !== "string" || !maybeStep.trim()) return null;

  const maybeContext = payloadObj.context;
  const context: LoadingContext =
    typeof maybeContext === "string" && maybeContext.trim()
      ? maybeContext
      : inferContextFromStep(maybeStep);

  const percent = payloadObj.percent;
  const percentage = payloadObj.percentage;
  const message = payloadObj.message;
  const elapsed = payloadObj.elapsed;
  const estimatedRemaining = payloadObj.estimatedRemaining;

  return {
    context,
    step: maybeStep,
    percent: typeof percent === "number" ? percent : undefined,
    percentage: typeof percentage === "number" ? percentage : undefined,
    message: typeof message === "string" ? message : undefined,
    elapsed: typeof elapsed === "number" ? elapsed : undefined,
    estimatedRemaining: typeof estimatedRemaining === "number" ? estimatedRemaining : undefined,
  };
}

function inferContextFromStep(step: string): LoadingContext {
  if (step === "extensionLoading" || step === "languageServerLoading") {
    return "environment";
  }
  return "wiki";
}
