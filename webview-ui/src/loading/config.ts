import type { KnownLoadingContext, LoadingConfigMap } from "@//loading/types";

export const defaultLoadingConfig: LoadingConfigMap = {
  wiki: { timeoutMs: 30000, density: "medium" },
  settings: { timeoutMs: 15000, density: "low" },
  navigation: { timeoutMs: 15000, density: "low" },
  environment: { timeoutMs: 24000, density: "low" },
  savedWikis: { timeoutMs: 24000, density: "low" },
  errorHistory: { timeoutMs: 15000, density: "low" },
  readmeUpdate: { timeoutMs: 90000, density: "medium" },
};

export function getContextTimeout(context: KnownLoadingContext): number | null {
  return defaultLoadingConfig[context]?.timeoutMs ?? null;
}

export function getContextDensity(context: KnownLoadingContext) {
  return defaultLoadingConfig[context]?.density ?? "medium";
}
