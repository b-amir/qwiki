import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import { buildWikiPrompt } from "../prompt";
import { ProviderError, ErrorCodes } from "../../errors";

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
}
