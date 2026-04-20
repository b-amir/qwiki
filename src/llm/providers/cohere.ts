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
import { fetchCohereChatModelIds } from "@/llm/model-catalog/fetchCohereModels";

const COHERE_MODELS = [
  "command-r7b-12-2024",
  "command-a-03-2025",
  "command-r-plus-08-2024",
  "command-r-08-2024",
];

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

    if (model === "command-a-03-2025") {
      return {
        ...baseCapabilities,
        maxTokens: 8192,
        contextWindowSize: 262144,
        streaming: true,
        functionCalling: true,
      };
    }
    if (model === "command-r7b-12-2024") {
      return {
        ...baseCapabilities,
        maxTokens: 4096,
        contextWindowSize: 131072,
        streaming: true,
        functionCalling: true,
      };
    }
    if (model === "command-r-plus-08-2024") {
      return {
        ...baseCapabilities,
        maxTokens: 4096,
        contextWindowSize: 131072,
        streaming: true,
        functionCalling: true,
      };
    }
    if (model === "command-r-08-2024") {
      return {
        ...baseCapabilities,
        maxTokens: 4096,
        contextWindowSize: 128000,
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

    let accumulatedContent = "";
    for await (const chunk of this.generateStream(params, apiKey)) {
      accumulatedContent += chunk;
    }
    return { content: accumulatedContent };
  }

  async *generateStream(params: GenerateParams, apiKey?: string): AsyncGenerator<string> {
    if (!apiKey) {
      throw new ProviderError(ErrorCodes.API_KEY_MISSING, "Cohere API key is not set", this.id);
    }

    const model = params.model || COHERE_MODELS[0];
    const url = "https://api.cohere.com/v1/chat";
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
          model,
          message: prompt,
          temperature: 0.2,
          max_tokens: 4096,
          stream: true,
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

    if (!res.body) {
      throw new ProviderError(ErrorCodes.GENERATION_FAILED, "Response body is null", this.id);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmedLine.slice(6));
              const text = data?.text || data?.delta?.text;
              if (text) {
                yield text;
              }
            } catch (parseError) {
              // Skip malformed JSON lines
              continue;
            }
          } else if (trimmedLine.startsWith("{")) {
            try {
              const data = JSON.parse(trimmedLine);
              const text = data?.text || data?.delta?.text;
              if (text) {
                yield text;
              }
            } catch (parseError) {
              // Skip malformed JSON
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  listModels(): string[] {
    return COHERE_MODELS;
  }

  async listModelsDynamic(apiKey?: string): Promise<string[]> {
    if (!apiKey?.trim()) {
      return this.listModels();
    }
    try {
      const ids = await fetchCohereChatModelIds(apiKey.trim());
      return ids.length > 0 ? ids : this.listModels();
    } catch {
      return this.listModels();
    }
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
      this.healthCheckWithKey?.(undefined) ?? performHealthCheck("https://api.cohere.com/v1/models")
    );
  }

  async healthCheckWithKey(apiKey?: string): Promise<HealthCheckResult> {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return performHealthCheck("https://api.cohere.com/v1/models", headers);
  }
}
