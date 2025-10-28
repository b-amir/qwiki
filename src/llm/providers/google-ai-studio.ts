import type { LLMProvider, GenerateParams, GenerateResult, ProviderUiConfig } from "../types";
import { buildWikiPrompt } from "../prompt";

const GOOGLE_AI_STUDIO_MODELS = ["gemini-2.5-pro", "gemini-2.5-flash"];

export class GoogleAIStudioProvider implements LLMProvider {
  id = "google-ai-studio" as const;
  name = "Google AI Studio";
  requiresApiKey = true;

  constructor(private useNativeEndpoint: boolean = false) {}

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new Error(`Google AI Studio API key is not set`);
    }

    console.log(`[GoogleAIStudio] Provider ID: ${this.id}`);
    console.log(`[GoogleAIStudio] API key present: ${!!apiKey}`);
    console.log(`[GoogleAIStudio] Using native endpoint: ${this.useNativeEndpoint}`);

    const model = params.model || "gemini-2.5-pro";
    const prompt = buildWikiPrompt(params);

    if (this.useNativeEndpoint) {
      // Native Google AI Studio endpoint (for future extension)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      console.log(`[GoogleAIStudio] Native endpoint URL: ${url.replace(apiKey, "***")}`);

      const body = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      console.log(`[GoogleAIStudio] Native endpoint response status: ${res.status}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google AI Studio request failed: ${res.status} ${text}`);
      }

      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") || "";
      return { content: text };
    } else {
      // OpenAI-compatible endpoint
      const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
      console.log(`[GoogleAIStudio] OpenAI-compatible endpoint URL: ${url}`);
      console.log(`[GoogleAIStudio] Request headers will include Authorization: Bearer ***`);

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
          max_tokens: 2048,
        }),
      });
      console.log(`[GoogleAIStudio] OpenAI-compatible endpoint response status: ${res.status}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Google AI Studio request failed: ${res.status} ${text}`);
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
      hasEndpointType: true,
      modelFallbackIds: [],
      defaultModel: "gemini-2.5-pro",
    };
  }
}
