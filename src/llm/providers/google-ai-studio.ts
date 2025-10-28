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

    const model = params.model || "gemini-2.5-pro";
    const prompt = buildWikiPrompt(params);

    if (this.useNativeEndpoint) {
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
        throw new Error(`Google AI Studio request failed: ${res.status} ${text}`);
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
