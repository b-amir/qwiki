import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import { buildWikiPrompt } from "../prompt";
import { ProviderError, ErrorCodes } from "../../errors";
import {
  ProviderCapabilities,
  ProviderFeature,
  ValidationResult,
  HealthCheckResult,
} from "../types/ProviderCapabilities";

const HUGGINGFACE_MODELS = [
  "bigscience/bloomz-7b1",
  "tiiuae/falcon-7b-instruct",
  "microsoft/CodeT5-base",
  "codellama/CodeLlama-7b-Instruct-hf",
];

export class HuggingFaceProvider implements LLMProvider {
  id = "huggingface" as const;
  name = "Hugging Face";
  requiresApiKey = true;
  capabilities: ProviderCapabilities = {
    maxTokens: 3072,
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
    contextWindowSize: 2048,
    rateLimitPerMinute: 30,
  };

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new ProviderError(
        ErrorCodes.API_KEY_MISSING,
        "Hugging Face API key is not set",
        this.id,
      );
    }

    const model = params.model || HUGGINGFACE_MODELS[0];
    const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
    const prompt = buildWikiPrompt(params);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          temperature: 0.2,
          max_new_tokens: 3072,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        throw new ProviderError(
          ErrorCodes.API_KEY_INVALID,
          "Hugging Face API key is invalid",
          this.id,
          text,
        );
      }
      if (res.status === 429) {
        throw new ProviderError(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          "Hugging Face rate limit exceeded",
          this.id,
          text,
        );
      }
      if (res.status >= 500) {
        throw new ProviderError(
          ErrorCodes.NETWORK_ERROR,
          "Hugging Face server error",
          this.id,
          text,
        );
      }
      throw new ProviderError(
        ErrorCodes.GENERATION_FAILED,
        `Hugging Face request failed: ${res.status}`,
        this.id,
        text,
      );
    }

    const data: any = await res.json();
    let content = "";
    if (Array.isArray(data)) {
      content = data[0]?.generated_text || "";
    } else {
      content = data?.generated_text || "";
    }

    if (content && typeof content === "string" && content.includes(prompt)) {
      content = content.replace(prompt, "").trim();
    }

    return { content };
  }

  listModels(): string[] {
    return HUGGINGFACE_MODELS;
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "https://huggingface.co/settings/tokens",
      apiKeyInput: "huggingfaceKeyInput",
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
      const response = await fetch("https://huggingface.co/api/models", {
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
