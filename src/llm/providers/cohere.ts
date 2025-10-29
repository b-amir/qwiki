import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import { buildWikiPrompt } from "../prompt";
import { ProviderError, ErrorCodes } from "../../errors";
import {
  ProviderCapabilities,
  ProviderFeature,
  ValidationResult,
  HealthCheckResult,
} from "../types/ProviderCapabilities";

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
    ],
    streaming: false,
    functionCalling: false,
    contextWindowSize: 4096,
    rateLimitPerMinute: 100,
  };

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new ProviderError(ErrorCodes.API_KEY_MISSING, "Cohere API key is not set", this.id);
    }

    const model = params.model || COHERE_MODELS[0];
    const url = "https://api.cohere.com/v1/chat";
    const prompt = buildWikiPrompt(params);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError(
          ErrorCodes.NETWORK_ERROR,
          "Cohere request timed out after 30 seconds",
          this.id,
          "Request timeout",
        );
      }
      throw error;
    }

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        throw new ProviderError(
          ErrorCodes.API_KEY_INVALID,
          "Cohere API key is invalid",
          this.id,
          text,
        );
      }
      if (res.status === 429) {
        throw new ProviderError(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          "Cohere rate limit exceeded",
          this.id,
          text,
        );
      }
      if (res.status >= 500) {
        throw new ProviderError(ErrorCodes.NETWORK_ERROR, "Cohere server error", this.id, text);
      }
      throw new ProviderError(
        ErrorCodes.GENERATION_FAILED,
        `Cohere request failed: ${res.status}`,
        this.id,
        text,
      );
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
    const startTime = Date.now();

    try {
      const response = await fetch("https://api.cohere.com/v1/models", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          isHealthy: true,
          responseTime,
          lastChecked: new Date(),
        };
      } else {
        return {
          isHealthy: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
          lastChecked: new Date(),
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date(),
      };
    }
  }
}
