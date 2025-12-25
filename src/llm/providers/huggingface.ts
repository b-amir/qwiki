import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "@/llm/types";
import type { ProviderConfig } from "@/domain/types";
import { buildWikiPrompt } from "@/llm/prompt";
import { ProviderError, ErrorCodes } from "@/errors";
import {
  ProviderCapabilities,
  ProviderFeature,
  ValidationResult,
  HealthCheckResult,
} from "../types/ProviderCapabilities";
import { handleHttpError, handleTimeoutError } from "@/llm/providers/helpers/httpErrorHandler";
import { performHealthCheck } from "@/llm/providers/helpers/healthCheckHelper";
import { ServiceLimits } from "@/constants";

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
      ProviderFeature.STREAMING_RESPONSE,
    ],
    streaming: true,
    functionCalling: false,
    contextWindowSize: 4096,
    rateLimitPerMinute: 30,
  };

  getModelCapabilities(model?: string): ProviderCapabilities {
    const baseCapabilities = { ...this.capabilities };

    if (model === "codellama/CodeLlama-7b-Instruct-hf") {
      return {
        ...baseCapabilities,
        maxTokens: 4096,
        contextWindowSize: 16384,
        streaming: true,
        functionCalling: false,
      };
    } else if (model === "tiiuae/falcon-7b-instruct") {
      return {
        ...baseCapabilities,
        maxTokens: 2048,
        contextWindowSize: 2048,
        streaming: true,
        functionCalling: false,
      };
    } else if (model === "bigscience/bloomz-7b1") {
      return {
        ...baseCapabilities,
        maxTokens: 512,
        contextWindowSize: 2048,
        streaming: false,
        functionCalling: false,
      };
    } else if (model === "microsoft/CodeT5-base") {
      return {
        ...baseCapabilities,
        maxTokens: 512,
        contextWindowSize: 512,
        streaming: false,
        functionCalling: false,
      };
    }

    return baseCapabilities;
  }

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new ProviderError(
        ErrorCodes.API_KEY_MISSING,
        "Hugging Face API key is not set",
        this.id,
      );
    }

    const model = params.model || HUGGINGFACE_MODELS[0] || "bigscience/bloomz-7b1";
    const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`;
    const prompt = buildWikiPrompt(params, this.id);
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
          inputs: prompt,
          parameters: {
            temperature: 0.2,
            max_new_tokens: 3072,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      handleTimeoutError(error, this.id, "Hugging Face", timeout);
    }

    if (!res.ok) {
      const text = await res.text();
      handleHttpError(res, this.id, "Hugging Face", text);
    }

    const data = (await res.json()) as
      | Array<{ generated_text?: string }>
      | { generated_text?: string };
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

  validateConfig(config: ProviderConfig): ValidationResult {
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
      this.healthCheckWithKey?.(undefined) ??
      performHealthCheck("https://huggingface.co/api/models")
    );
  }

  async healthCheckWithKey(apiKey?: string): Promise<HealthCheckResult> {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return performHealthCheck("https://huggingface.co/api/models", headers);
  }
}
