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
  if (!payload || typeof payload !== "object") return null;
  const maybeStep = (payload as any).step;
  if (typeof maybeStep !== "string" || !maybeStep.trim()) return null;

  const maybeContext = (payload as any).context;
  const context: LoadingContext =
    typeof maybeContext === "string" && maybeContext.trim()
      ? maybeContext
      : inferContextFromStep(maybeStep);

  const percent = (payload as any).percent;
  return {
    context,
    step: maybeStep,
    percent: typeof percent === "number" ? percent : undefined,
  };
}

function inferContextFromStep(step: string): LoadingContext {
  if (step === "extensionLoading" || step === "languageServerLoading") {
    return "environment";
  }
  return "wiki";
}
