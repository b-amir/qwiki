import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "@/llm/types";
import type { ProviderConfig } from "@/domain/types";
import type { GetSetting } from "@/llm/providers/registry";
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
import { fetchGoogleGeminiChatModelIds } from "@/llm/model-catalog/fetchGoogleGeminiModels";

const GOOGLE_AI_STUDIO_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite-preview",
];

export class GoogleAIStudioProvider implements LLMProvider {
  id = "google-ai-studio" as const;
  name = "Google AI Studio";
  requiresApiKey = true;
  capabilities: ProviderCapabilities = {
    maxTokens: 8192,
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
    contextWindowSize: 1048576,
    rateLimitPerMinute: 60,
  };

  getModelCapabilities(model?: string): ProviderCapabilities {
    const baseCapabilities = { ...this.capabilities };
    if (model === "gemini-2.5-pro" || model === "gemini-3.1-pro-preview") {
      return {
        ...baseCapabilities,
        maxTokens: 8192,
        contextWindowSize: 1048576,
        streaming: true,
        functionCalling: true,
      };
    } else if (
      model === "gemini-2.5-flash" ||
      model === "gemini-2.5-flash-lite" ||
      model === "gemini-3-flash-preview" ||
      model === "gemini-3.1-flash-lite-preview"
    ) {
      return {
        ...baseCapabilities,
        maxTokens: 8192,
        contextWindowSize: 1048576,
        streaming: true,
        functionCalling: true,
      };
    }

    return baseCapabilities;
  }

  constructor(private getSetting?: GetSetting) {}

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new ProviderError(
        ErrorCodes.API_KEY_MISSING,
        "Google AI Studio API key is not set",
        this.id,
      );
    }

    let accumulatedContent = "";
    for await (const chunk of this.generateStream(params, apiKey)) {
      accumulatedContent += chunk;
    }
    return { content: accumulatedContent };
  }

  async *generateStream(params: GenerateParams, apiKey?: string): AsyncGenerator<string> {
    if (!apiKey) {
      throw new ProviderError(
        ErrorCodes.API_KEY_MISSING,
        "Google AI Studio API key is not set",
        this.id,
      );
    }

    const model = params.model || "gemini-2.5-flash";
    const prompt = buildWikiPrompt(params, this.id);
    const timeout = params.timeoutMs ?? ServiceLimits.operationDefaultTimeout;

    const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

    const messages = [
      {
        role: "system",
        content:
          "You are a senior software engineer helping with code comprehension and best practices.",
      },
      { role: "user", content: prompt },
    ];

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
          messages,
          temperature: 0.2,
          max_tokens: 4096,
          stream: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      handleTimeoutError(error, this.id, "Google AI Studio", timeout);
    }

    if (!res.ok) {
      const text = await res.text();
      handleHttpError(res, this.id, "Google AI Studio", text);
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
          if (!trimmedLine || trimmedLine === "data: [DONE]") continue;

          if (trimmedLine.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmedLine.slice(6));
              const content = data?.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (parseError) {
              // Skip malformed JSON lines
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
    return GOOGLE_AI_STUDIO_MODELS;
  }

  async listModelsDynamic(apiKey?: string): Promise<string[]> {
    if (!apiKey?.trim()) {
      return this.listModels();
    }
    try {
      const ids = await fetchGoogleGeminiChatModelIds(apiKey.trim());
      return ids.length > 0 ? ids : this.listModels();
    } catch {
      return this.listModels();
    }
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "https://aistudio.google.com/app/apikey",
      apiKeyInput: "googleAIStudioKeyInput",
      modelFallbackIds: [],
      defaultModel: "gemini-2.5-flash",
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
      performHealthCheck("https://generativelanguage.googleapis.com/v1beta/openai/models")
    );
  }

  async healthCheckWithKey(apiKey?: string): Promise<HealthCheckResult> {
    if (apiKey) {
      return performHealthCheck(
        "https://generativelanguage.googleapis.com/v1beta/openai/models",
        { Authorization: `Bearer ${apiKey}` },
      );
    }

    return performHealthCheck("https://generativelanguage.googleapis.com/v1beta/openai/models");
  }
}
