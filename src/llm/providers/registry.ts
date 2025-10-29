import type { LLMProvider } from "../types";
import { ZAiProvider } from "./zai";
import { OpenRouterProvider } from "./openrouter";
import { GoogleAIStudioProvider } from "./google-ai-studio";
import { CohereProvider } from "./cohere";
import { HuggingFaceProvider } from "./huggingface";

export type GetSetting = (key: string) => Promise<any>;

export function loadProviders(getSetting: GetSetting): Record<string, LLMProvider> {
  const providers: Record<string, LLMProvider> = {};

  providers["google-ai-studio"] = new GoogleAIStudioProvider(getSetting);
  providers["zai"] = new ZAiProvider(getSetting);
  providers["openrouter"] = new OpenRouterProvider();
  providers["cohere"] = new CohereProvider();
  providers["huggingface"] = new HuggingFaceProvider();

  return providers;
}
