export type GenerateParams = {
  snippet: string;
  languageId?: string;
  filePath?: string;
  model?: string;
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
  generate(params: GenerateParams, apiKey: string | undefined): Promise<GenerateResult>;
  listModels(): string[];
  // UI configuration for settings page
  getUiConfig?(): ProviderUiConfig;
}

export interface ProviderUiConfig {
  apiKeyUrl: string;
  apiKeyInput: string; // Property name in settings store
  additionalInfo?: string;
  hasEndpointType?: boolean;
  modelFallbackIds?: string[];
}

export type ProviderId = "zai" | "openrouter" | "google-ai-studio" | "cohere" | "huggingface";
