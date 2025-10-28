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
  getUiConfig?(): ProviderUiConfig;
}

export interface ProviderUiConfig {
  apiKeyUrl: string;
  apiKeyInput: string;
  additionalInfo?: string;
  hasEndpointType?: boolean;
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

export type ProviderId = "zai" | "openrouter" | "google-ai-studio" | "cohere" | "huggingface";
