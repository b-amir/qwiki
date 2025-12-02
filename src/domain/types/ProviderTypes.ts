export interface ProviderConfigBase {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ProviderConfig extends ProviderConfigBase {
  [key: string]: unknown;
}

export function isProviderConfig(value: unknown): value is ProviderConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (obj.apiKey !== undefined && typeof obj.apiKey !== "string") {
    return false;
  }
  if (obj.model !== undefined && typeof obj.model !== "string") {
    return false;
  }
  if (obj.temperature !== undefined && typeof obj.temperature !== "number") {
    return false;
  }
  if (obj.maxTokens !== undefined && typeof obj.maxTokens !== "number") {
    return false;
  }
  return true;
}

export function asProviderConfig(value: unknown): ProviderConfig {
  if (isProviderConfig(value)) {
    return value;
  }
  return {};
}
