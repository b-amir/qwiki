export const KNOWN_CONTEXTS = [
  "wiki",
  "settings",
  "navigation",
  "environment",
  "savedWikis",
  "errorHistory",
  "readmeUpdate",
] as const;

export type KnownLoadingContext = (typeof KNOWN_CONTEXTS)[number];

export type LoadingContext = KnownLoadingContext | (string & {});

export function isKnownContext(context: LoadingContext): context is KnownLoadingContext {
  return (KNOWN_CONTEXTS as readonly string[]).includes(context);
}

export type LoadingDensity = "low" | "medium" | "high";

export interface LoadingStepDefinition {
  key: string;
  text: string;
}

export interface LoadingMessage {
  context: LoadingContext;
  step: string;
  percent?: number;
  percentage?: number;
  message?: string;
  elapsed?: number;
  estimatedRemaining?: number;
}

export interface LoadingStateSnapshot {
  active: boolean;
  step: string | null;
  percent: number | null;
  percentage: number | null;
  message: string | null;
  elapsed: number | null;
  estimatedRemaining: number | null;
  startedAt: number | null;
  timeoutMs: number | null;
  error: string | null;
  cancelled: boolean;
}

export interface LoadingStartOptions {
  context: LoadingContext;
  step?: string;
  timeoutMs?: number;
}

export interface LoadingAdvanceOptions {
  context: LoadingContext;
  step: string;
  percent?: number | null;
  message?: string | null;
  elapsed?: number | null;
  estimatedRemaining?: number | null;
}

export interface LoadingCompleteOptions {
  context: LoadingContext;
}

export interface LoadingFailOptions {
  context: LoadingContext;
  error: string;
}

export interface LoadingCancelOptions {
  context: LoadingContext;
  reason?: string;
}

export interface LoadingConfig {
  timeoutMs: number | null;
  density: LoadingDensity;
}

export type LoadingConfigMap = Partial<Record<KnownLoadingContext, LoadingConfig>>;
