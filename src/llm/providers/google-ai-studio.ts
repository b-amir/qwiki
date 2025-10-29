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
    ],
    streaming: false,
    functionCalling: false,
    contextWindowSize: 32768,
    rateLimitPerMinute: 60,
  };

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

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          throw new ProviderError(
            ErrorCodes.API_KEY_INVALID,
            "Google AI Studio API key is invalid",
            this.id,
            text,
          );
        }
        if (res.status === 429) {
          throw new ProviderError(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            "Google AI Studio rate limit exceeded",
            this.id,
            text,
          );
        }
        if (res.status >= 500) {
          throw new ProviderError(
            ErrorCodes.NETWORK_ERROR,
            "Google AI Studio server error",
            this.id,
            text,
          );
        }
        throw new ProviderError(
          ErrorCodes.GENERATION_FAILED,
          `Google AI Studio request failed: ${res.status}`,
          this.id,
          text,
        );
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

      const res = await fetch(url, {
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
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          throw new ProviderError(
            ErrorCodes.API_KEY_INVALID,
            "Google AI Studio API key is invalid",
            this.id,
            text,
          );
        }
        if (res.status === 429) {
          throw new ProviderError(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            "Google AI Studio rate limit exceeded",
            this.id,
            text,
          );
        }
        if (res.status >= 500) {
          throw new ProviderError(
            ErrorCodes.NETWORK_ERROR,
            "Google AI Studio server error",
            this.id,
            text,
          );
        }
        throw new ProviderError(
          ErrorCodes.GENERATION_FAILED,
          `Google AI Studio request failed: ${res.status}`,
          this.id,
          text,
        );
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
    const startTime = Date.now();

    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
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
