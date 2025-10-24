import type { LLMProvider, GenerateParams, GenerateResult } from "../types";
import { buildWikiPrompt } from "../prompt";

const GEMINI_MODELS = [
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
];

export class GeminiProvider implements LLMProvider {
  id = "gemini" as const;
  name = "Gemini";
  requiresApiKey = true;

  async generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult> {
    if (!apiKey) {
      throw new Error("Gemini API key is not set");
    }
    const model = params.model || "gemini-1.5-pro";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const prompt = buildWikiPrompt(params);

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
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini request failed: ${res.status} ${text}`);
    }
    const data: any = await res.json();
    // Extract plain text from candidates
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") || "";
    return { content: text };
  }

  listModels(): string[] {
    return GEMINI_MODELS;
  }
}
