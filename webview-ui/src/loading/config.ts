import type { KnownLoadingContext, LoadingConfigMap } from "./types";

export const defaultLoadingConfig: LoadingConfigMap = {
  wiki: { timeoutMs: 10000, density: "medium" },
  settings: { timeoutMs: 5000, density: "low" },
  navigation: { timeoutMs: 5000, density: "low" },
  environment: { timeoutMs: 8000, density: "low" },
  savedWikis: { timeoutMs: 8000, density: "low" },
  errorHistory: { timeoutMs: 5000, density: "low" },
  readmeUpdate: { timeoutMs: 30000, density: "medium" },
};

export function getContextTimeout(context: KnownLoadingContext): number | null {
  return defaultLoadingConfig[context]?.timeoutMs ?? null;
}

export function getContextDensity(context: KnownLoadingContext) {
  return defaultLoadingConfig[context]?.density ?? "medium";
}
