import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import type { GetSetting } from "./registry";
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

const GOOGLE_AI_STUDIO_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"];

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
    if (model === "gemini-2.5-pro") {
      return {
        ...baseCapabilities,
        maxTokens: 8192,
        contextWindowSize: 1048576,
        streaming: true,
        functionCalling: true,
      };
    } else if (model === "gemini-2.5-flash") {
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

    const model = params.model || "gemini-2.5-pro";
    const endpointType = (
      this.getSetting ? await this.getSetting("googleAIEndpoint") : undefined
    ) as "openai-compatible" | "native" | undefined;
    const useNativeEndpoint = endpointType === "native";
    const prompt = buildWikiPrompt(params);
    const timeout = params.timeoutMs ?? ServiceLimits.operationDefaultTimeout;

    if (useNativeEndpoint) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const body = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "text/markdown",
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
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

      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") || "";
      return { content: text };
    } else {
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

      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content || "";
      return { content };
    }
  }

  listModels(): string[] {
    return GOOGLE_AI_STUDIO_MODELS;
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "https://aistudio.google.com/app/apikey",
      apiKeyInput: "googleAIStudioKeyInput",
      modelFallbackIds: [],
      defaultModel: "gemini-2.5-pro",
      customFields: [
        {
          id: "googleAIEndpoint",
          label: "Endpoint Type",
          type: "select",
          options: ["openai-compatible", "native"],
          defaultValue: "openai-compatible",
        },
      ],
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
      this.healthCheckWithKey?.(undefined) ??
      performHealthCheck("https://generativelanguage.googleapis.com/v1beta/models")
    );
  }

  async healthCheckWithKey(apiKey?: string): Promise<HealthCheckResult> {
    const endpointType = (
      this.getSetting ? await this.getSetting("googleAIEndpoint") : undefined
    ) as "openai-compatible" | "native" | undefined;

    if (apiKey) {
      if (endpointType === "openai-compatible") {
        return performHealthCheck(
          "https://generativelanguage.googleapis.com/v1beta/openai/models",
          { Authorization: `Bearer ${apiKey}` },
        );
      } else {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
          apiKey,
        )}`;
        return performHealthCheck(url);
      }
    }

    return performHealthCheck("https://generativelanguage.googleapis.com/v1beta/models");
  }
}
