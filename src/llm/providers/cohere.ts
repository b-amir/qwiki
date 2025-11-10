import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import { buildWikiPrompt } from "../prompt";
import { ProviderError, ErrorCodes } from "../../errors";
import {
  ProviderCapabilities,
  ProviderFeature,
  ValidationResult,
  HealthCheckResult,
} from "../types/ProviderCapabilities";
import { handleHttpError, handleTimeoutError } from "./helpers/httpErrorHandler";
import { performHealthCheck } from "./helpers/healthCheckHelper";
import { ServiceLimits } from "../../constants";

const COHERE_MODELS = ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024"];

export class CohereProvider implements LLMProvider {
  id = "cohere" as const;
  name = "Cohere";
  requiresApiKey = true;
  capabilities: ProviderCapabilities = {
    maxTokens: 4096,
    supportedLanguages: [
      "javascript",
      "typescript",
      "python",
      "java",
      "csharp",
      "go",
      "rust",
      "php",
      "ruby",
      "swift",
      "kotlin",
      "scala",
      "dart",
      "html",
      "css",
      "json",
      "xml",
      "yaml",
      "markdown",
    ],
    features: [
      ProviderFeature.CODE_ANALYSIS,
      ProviderFeature.DOCUMENTATION_GENERATION,
      ProviderFeature.MULTI_LANGUAGE,
      ProviderFeature.CONTEXT_AWARENESS,
      ProviderFeature.STREAMING_RESPONSE,
      ProviderFeature.FUNCTION_CALLING,
    ],
    streaming: true,
    functionCalling: true,
    contextWindowSize: 131072, // 128k tokens for Command R Plus
    rateLimitPerMinute: 100,
  };

  getModelCapabilities(model?: string): ProviderCapabilities {
    const baseCapabilities = { ...this.capabilities };

    if (model === "command-r-plus-08-2024") {
      return {
        ...baseCapabilities,
        maxTokens: 4096,
        contextWindowSize: 131072, // 128k tokens
        streaming: true,
        functionCalling: true,
      };
    } else if (model === "command-r-08-2024") {
      return {
        ...baseCapabilities,
        maxTokens: 4096,
        contextWindowSize: 100000, // 100k tokens
        streaming: true,
        functionCalling: true,
      };
    } else if (model === "command-a-03-2025") {
      return {
        ...baseCapabilities,
        maxTokens: 4096,
        contextWindowSize: 131072, // 128k tokens
        streaming: true,
        functionCalling: true,
      };
    }

    return baseCapabilities;
  }

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new ProviderError(ErrorCodes.API_KEY_MISSING, "Cohere API key is not set", this.id);
    }

    const model = params.model || COHERE_MODELS[0];
    const url = "https://api.cohere.com/v1/chat";
    const prompt = buildWikiPrompt(params);
    const timeout = params.timeoutMs ?? ServiceLimits.operationDefaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          message: prompt,
          temperature: 0.2,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      handleTimeoutError(error, this.id, "Cohere", timeout);
    }

    if (!res.ok) {
      const text = await res.text();
      handleHttpError(res, this.id, "Cohere", text);
    }

    const data: any = await res.json();
    const content = data?.text || data?.message?.content || "";
    return { content };
  }

  listModels(): string[] {
    return COHERE_MODELS;
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "https://dashboard.cohere.com/api-keys",
      apiKeyInput: "cohereKeyInput",
    };
  }

  supportsCapability(capability: ProviderFeature): boolean {
    return this.capabilities.features.includes(capability);
  }

  validateConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.apiKey || typeof config.apiKey !== "string" || config.apiKey.trim().length === 0) {
      errors.push("API key is required and must be a non-empty string");
    }

    if (config.model && !this.listModels().includes(config.model)) {
      warnings.push(`Unknown model "${config.model}". Using default model.`);
    }

    if (
      config.temperature &&
      (typeof config.temperature !== "number" || config.temperature < 0 || config.temperature > 2)
    ) {
      errors.push("Temperature must be a number between 0 and 2");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  async healthCheck(): Promise<HealthCheckResult> {
    return (
      this.healthCheckWithKey?.(undefined) ?? performHealthCheck("https://api.cohere.com/v1/models")
    );
  }

  async healthCheckWithKey(apiKey?: string): Promise<HealthCheckResult> {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return performHealthCheck("https://api.cohere.com/v1/models", headers);
  }
}
