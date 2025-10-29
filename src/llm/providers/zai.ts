import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import type { GetSetting } from "./registry";
import { buildWikiPrompt } from "../prompt";
import { getNonce } from "../../utilities/getNonce";
import { ProviderError, ErrorCodes } from "../../errors";

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
}
