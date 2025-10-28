import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import { buildWikiPrompt } from "../prompt";

const COHERE_MODELS = ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024"];

export class CohereProvider implements LLMProvider {
  id = "cohere" as const;
  name = "Cohere";
  requiresApiKey = true;

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new Error("Cohere API key is not set");
    }

    const model = params.model || COHERE_MODELS[0];
    const url = "https://api.cohere.com/v1/chat";
    const prompt = buildWikiPrompt(params);

    const res = await fetch(url, {
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
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cohere request failed: ${res.status} ${text}`);
    }

    const data: any = await res.json();
    const content = data?.text || data?.message?.content || "";
    return { content };
  }

  listModels(): string[] {
    return COHERE_MODELS;
  }

  getUiConfig(): ProviderUiConfig {
    return {
      apiKeyUrl: "https://dashboard.cohere.com/api-keys",
      apiKeyInput: "cohereKeyInput",
    };
  }
}
