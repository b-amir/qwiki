export interface ProviderCapabilities {
  maxTokens: number;
  supportedLanguages: string[];
  features: ProviderFeature[];
  streaming: boolean;
  functionCalling: boolean;
  contextWindowSize: number;
  rateLimitPerMinute: number;
}

export enum ProviderFeature {
  CODE_ANALYSIS = "code-analysis",
  DOCUMENTATION_GENERATION = "documentation-generation",
  MULTI_LANGUAGE = "multi-language",
  CONTEXT_AWARENESS = "context-awareness",
  STREAMING_RESPONSE = "streaming-response",
  FUNCTION_CALLING = "function-calling",
  CUSTOM_PROMPTS = "custom-prompts",
}

export interface CapabilityRequirement {
  requiredFeatures: ProviderFeature[];
  minTokens?: number;
  preferredLanguages?: string[];
  requiresStreaming?: boolean;
  requiresFunctionCalling?: boolean;
  minContextWindow?: number;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  lastChecked: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
