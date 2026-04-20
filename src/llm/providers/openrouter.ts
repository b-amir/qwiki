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
import { fetchOpenRouterFreeChatModelIds } from "@/llm/model-catalog/fetchOpenRouterModels";

const OPENROUTER_MODELS = [
  "qwen/qwen3-coder:free",
  "z-ai/glm-4.5-air:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "stepfun/step-3.5-flash:free",
  "google/gemma-3-27b-it:free",
];

const OPENROUTER_FREE_MODEL_CAPS = new Map<
  string,
  { maxTokens: number; contextWindowSize: number }
>([
  ["qwen/qwen3-coder:free", { maxTokens: 8192, contextWindowSize: 262000 }],
  ["z-ai/glm-4.5-air:free", { maxTokens: 8192, contextWindowSize: 131072 }],
  ["openai/gpt-oss-120b:free", { maxTokens: 8192, contextWindowSize: 131072 }],
  ["nvidia/nemotron-3-super-120b-a12b:free", { maxTokens: 8192, contextWindowSize: 1048576 }],
  ["stepfun/step-3.5-flash:free", { maxTokens: 8192, contextWindowSize: 262144 }],
  ["google/gemma-3-27b-it:free", { maxTokens: 8192, contextWindowSize: 131072 }],
]);

export class OpenRouterProvider implements LLMProvider {
  id = "openrouter" as const;
  name = "OpenRouter";
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
    contextWindowSize: 8192, // Varies by model, using conservative default
    rateLimitPerMinute: 100,
  };

  getModelCapabilities(model?: string): ProviderCapabilities {
    const baseCapabilities = { ...this.capabilities };
    if (!model) {
      return baseCapabilities;
    }
    const caps = OPENROUTER_FREE_MODEL_CAPS.get(model);
    if (!caps) {
      return baseCapabilities;
    }
    return {
      ...baseCapabilities,
      maxTokens: caps.maxTokens,
      contextWindowSize: caps.contextWindowSize,
      streaming: true,
      functionCalling: true,
    };
  }

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new ProviderError(ErrorCodes.API_KEY_MISSING, "OpenRouter API key is not set", this.id);
    }

    let accumulatedContent = "";
    for await (const chunk of this.generateStream(params, apiKey)) {
      accumulatedContent += chunk;
    }
    return { content: accumulatedContent };
  }

  async *generateStream(params: GenerateParams, apiKey?: string): AsyncGenerator<string> {
    if (!apiKey) {
      throw new ProviderError(ErrorCodes.API_KEY_MISSING, "OpenRouter API key is not set", this.id);
    }

    const model = params.model || OPENROUTER_MODELS[0];
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const prompt = buildWikiPrompt(params, this.id);
    const timeout = params.timeoutMs ?? ServiceLimits.operationDefaultTimeout;

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
          "HTTP-Referer":
            "https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-qwiki",
          "X-Title": "Qwiki - VS Code Extension",
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
      handleTimeoutError(error, this.id, "OpenRouter", timeout);
    }

    if (!res.ok) {
      const text = await res.text();
      handleHttpError(res, this.id, "OpenRouter", text);
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
    return OPENROUTER_MODELS;
  }

  async listModelsDynamic(apiKey?: string): Promise<string[]> {
    try {
      const ids = await fetchOpenRouterFreeChatModelIds(apiKey?.trim());
      return ids.length > 0 ? ids : this.listModels();
    } catch {
      return this.listModels();
    }
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "https://openrouter.ai/keys",
      apiKeyInput: "openrouterKeyInput",
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
      performHealthCheck("https://openrouter.ai/api/v1/models")
    );
  }

  async healthCheckWithKey(apiKey?: string): Promise<HealthCheckResult> {
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return performHealthCheck("https://openrouter.ai/api/v1/models", headers);
  }
}
