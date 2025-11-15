import {
  ProviderCapabilities,
  ProviderFeature,
  ValidationResult,
  HealthCheckResult,
} from "./types/ProviderCapabilities";
import type { SemanticCodeInfo } from "@/infrastructure/services/integration/LanguageServerIntegrationService";

export type GenerateParams = {
  snippet: string;
  languageId?: string;
  filePath?: string;
  model?: string;
  timeoutMs?: number;
  semanticInfo?: SemanticCodeInfo;
  project?: {
    rootName?: string;
    overview?: string;
    filesSample?: string[];
    related?: Array<{
      path: string;
      preview?: string;
      line?: number;
      reason?: string;
    }>;
  };
};

export type GenerateResult = {
  content: string;
};

export interface LLMProvider {
  id: string;
  name: string;
  requiresApiKey: boolean;
  capabilities: ProviderCapabilities;
  generate(params: GenerateParams, apiKey: string | undefined): Promise<GenerateResult>;
  generateStream?(params: GenerateParams, apiKey: string | undefined): AsyncGenerator<string>;
  listModels(): string[];
  getUiConfig?(): ProviderUiConfig;
  supportsCapability(capability: ProviderFeature): boolean;
  validateConfig(config: any): ValidationResult;
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  getModelCapabilities?(model?: string): ProviderCapabilities;
}

export interface ProviderUiConfig {
  apiKeyUrl: string;
  apiKeyInput: string;
  additionalInfo?: string;
  modelFallbackIds?: string[];
  defaultModel?: string;
  customFields?: ProviderCustomField[];
}

export interface ProviderCustomField {
  id: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
}

export type ProviderId = string;
