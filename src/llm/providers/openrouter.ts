import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import { buildWikiPrompt } from "../prompt";
import { ProviderError, ErrorCodes } from "../../errors";

const OPENROUTER_MODELS = [
  "openai/gpt-oss-20b",
  "meta-llama/llama-3-8b-instruct",
  "microsoft/wizardlm-2-8x22b",
];

export class OpenRouterProvider implements LLMProvider {
  id = "openrouter" as const;
  name = "OpenRouter";
  requiresApiKey = true;

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new ProviderError(ErrorCodes.API_KEY_MISSING, "OpenRouter API key is not set", this.id);
    }

    const model = params.model || OPENROUTER_MODELS[0];
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const prompt = buildWikiPrompt(params);

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
        "HTTP-Referer":
          "https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-qwiki",
        "X-Title": "Qwiki - VS Code Extension",
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
          "OpenRouter API key is invalid",
          this.id,
          text,
        );
      }
      if (res.status === 429) {
        throw new ProviderError(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          "OpenRouter rate limit exceeded",
          this.id,
          text,
        );
      }
      if (res.status >= 500) {
        throw new ProviderError(ErrorCodes.NETWORK_ERROR, "OpenRouter server error", this.id, text);
      }
      throw new ProviderError(
        ErrorCodes.GENERATION_FAILED,
        `OpenRouter request failed: ${res.status}`,
        this.id,
        text,
      );
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    return { content };
  }

  listModels(): string[] {
    return OPENROUTER_MODELS;
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "https://openrouter.ai/keys",
      apiKeyInput: "openrouterKeyInput",
    };
  }
}
