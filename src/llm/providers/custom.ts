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

export class CustomProvider implements LLMProvider {
  id = "custom" as const;
  name = "Custom";
  requiresApiKey = true;
  capabilities: ProviderCapabilities = {
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
    contextWindowSize: 8192,
    rateLimitPerMinute: 60,
  };

  getModelCapabilities(): ProviderCapabilities {
    return { ...this.capabilities };
  }

  constructor(private getSetting?: GetSetting) {}

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new ProviderError(
        ErrorCodes.API_KEY_MISSING,
        "Custom provider API key is not set",
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
        "Custom provider API key is not set",
        this.id,
      );
    }

    const customEndpoint = (
      this.getSetting ? await this.getSetting("customEndpoint") : undefined
    ) as string | undefined;
    const customModel = (this.getSetting ? await this.getSetting("customModel") : undefined) as
      | string
      | undefined;

    if (!customEndpoint) {
      throw new ProviderError(
        ErrorCodes.CONFIGURATION_ERROR,
        "Custom endpoint URL is not configured",
        this.id,
      );
    }

    const model = customModel || params.model || "custom-model";
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
      res = await fetch(customEndpoint, {
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
      handleTimeoutError(error, this.id, "Custom", timeout);
    }

    if (!res.ok) {
      const text = await res.text();
      handleHttpError(res, this.id, "Custom", text);
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
    // Custom provider uses model from settings, not a predefined list
    return [];
  }

  async listModelsDynamic(): Promise<string[]> {
    return [];
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "",
      apiKeyInput: "customKeyInput",
      additionalInfo: "Configure your custom OpenAI-compatible provider endpoint and model",
      customFields: [
        {
          id: "customEndpoint",
          label: "Endpoint URL",
          type: "text",
          placeholder: "https://api.openai.com/v1/chat/completions",
          defaultValue: "",
        },
        {
          id: "customModel",
          label: "Model Name",
          type: "text",
          placeholder: "e.g. gpt-4, claude-3-opus-20240229, etc.",
          defaultValue: "",
        },
      ],
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

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async initialize(): Promise<void> {}

  async dispose(): Promise<void> {}

  async healthCheck(): Promise<HealthCheckResult> {
    return this.healthCheckWithKey(undefined);
  }

  async healthCheckWithKey(apiKey?: string): Promise<HealthCheckResult> {
    const customEndpoint = (
      this.getSetting ? await this.getSetting("customEndpoint") : undefined
    ) as string | undefined;
    const endpoint =
      customEndpoint?.replace(/\/chat\/completions$/, "/models") ||
      "https://api.openai.com/v1/models";

    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    return performHealthCheck(endpoint, headers);
  }
}
