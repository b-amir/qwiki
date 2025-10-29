import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import type { GetSetting } from "./registry";
import { buildWikiPrompt } from "../prompt";
import { getNonce } from "../../utilities/getNonce";
import { ProviderError, ErrorCodes } from "../../errors";
import {
  ProviderCapabilities,
  ProviderFeature,
  ValidationResult,
  HealthCheckResult,
} from "../types/ProviderCapabilities";

const ZAI_MODELS = [
  "glm-4.5-flash",
  "glm-4.5",
  "glm-4.5-air",
  "glm-4.5-airx",
  "glm-4.5-x",
  "glm-4.6",
  "glm-4-32b-0414-128k",
];

export class ZAiProvider implements LLMProvider {
  id = "zai" as const;
  name = "Z.ai";
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
    contextWindowSize: 128000,
    rateLimitPerMinute: 200,
  };

  constructor(private getSetting?: GetSetting) {}

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey)
      throw new ProviderError(ErrorCodes.API_KEY_MISSING, "Z.ai API key is not set", this.id);
    const model = params.model || ZAI_MODELS[0];
    const configuredBase = (this.getSetting ? await this.getSetting("zaiBaseUrl") : undefined) as
      | string
      | undefined;
    const base = configuredBase || process.env.ZAI_BASE_URL || "https://api.z.ai/api";
    const url = `${base.replace(/\/$/, "")}/paas/v4/chat/completions`;

    const messages = [
      {
        role: "system",
        content:
          "You are a senior software engineer helping with code comprehension and best practices.",
      },
      { role: "user", content: buildWikiPrompt(params) },
    ];

    const doRequest = async (modelName: string) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.2,
          top_p: 0.95,
          stream: false,
          max_tokens: 4096,
          request_id: `qwiki-${getNonce()}`,
          user_id: "qwiki-user",
        }),
      });

    let res = await doRequest(model);
    if (!res.ok) {
      const text = await res.text();
      try {
        const err = JSON.parse(text);
        const code = err?.error?.code;
        const msg = err?.error?.message || text;
        if (res.status === 429 && code === "1113") {
          for (const fb of ZAI_MODELS) {
            if (fb === model) continue;
            const attempt = await doRequest(fb);
            if (attempt.ok) {
              res = attempt;
              break;
            }
          }
          if (!res.ok) {
            throw new ProviderError(
              ErrorCodes.MODEL_NOT_SUPPORTED,
              `Z.ai model ${model} not supported. Likely your plan doesn't include the selected model. Select a model in your package (e.g., glm-4.5-flash) or set qwiki.zaiBaseUrl for your tenant and retry.`,
              this.id,
              text,
            );
          }
        }
        if (res.status === 401) {
          throw new ProviderError(
            ErrorCodes.API_KEY_INVALID,
            "Z.ai API key is invalid",
            this.id,
            text,
          );
        }
        if (res.status === 429) {
          throw new ProviderError(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            "Z.ai rate limit exceeded",
            this.id,
            text,
          );
        }
        if (res.status >= 500) {
          throw new ProviderError(ErrorCodes.NETWORK_ERROR, "Z.ai server error", this.id, text);
        }
        throw new ProviderError(
          ErrorCodes.GENERATION_FAILED,
          `Z.ai request failed: ${res.status} ${code ? `code ${code} ` : ""}${msg}`,
          this.id,
          text,
        );
      } catch {
        if (res.status === 401) {
          throw new ProviderError(
            ErrorCodes.API_KEY_INVALID,
            "Z.ai API key is invalid",
            this.id,
            text,
          );
        }
        if (res.status === 429) {
          throw new ProviderError(
            ErrorCodes.RATE_LIMIT_EXCEEDED,
            "Z.ai rate limit exceeded",
            this.id,
            text,
          );
        }
        if (res.status >= 500) {
          throw new ProviderError(ErrorCodes.NETWORK_ERROR, "Z.ai server error", this.id, text);
        }
        throw new ProviderError(
          ErrorCodes.GENERATION_FAILED,
          `Z.ai request failed: ${res.status} ${text}`,
          this.id,
          text,
        );
      }
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    return { content };
  }

  listModels(): string[] {
    return ZAI_MODELS;
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "https://z.ai",
      apiKeyInput: "zaiKeyInput",
      additionalInfo: "Optional: configure base URL for your Z.ai tenant",
      customFields: [
        {
          id: "zaiBaseUrl",
          label: "Base URL",
          type: "text",
          placeholder: "https://api.z.ai/api (default)",
          defaultValue: "",
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
      const configuredBase = (this.getSetting ? await this.getSetting("zaiBaseUrl") : undefined) as
        | string
        | undefined;
      const base = configuredBase || process.env.ZAI_BASE_URL || "https://api.z.ai/api";
      const url = `${base.replace(/\/$/, "")}/paas/v4/models`;

      const response = await fetch(url, {
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
