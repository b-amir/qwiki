import type { LLMProvider } from "../llm/types";
import { ZAiProvider } from "../llm/providers/zai";
import { OpenRouterProvider } from "../llm/providers/openrouter";
import { GoogleAIStudioProvider } from "../llm/providers/google-ai-studio";
import { CohereProvider } from "../llm/providers/cohere";
import { HuggingFaceProvider } from "../llm/providers/huggingface";
import { ProviderIds } from "../constants";

export interface LLMProviderSettings {
  zaiBaseUrl?: string;
  googleAIEndpoint?: string;
}

export class LLMProviderFactory {
  static createProvider(
    providerId: string,
    settings: LLMProviderSettings = {}
  ): LLMProvider | undefined {
    switch (providerId) {
      case ProviderIds.zai:
        return new ZAiProvider(settings.zaiBaseUrl);
      
      case ProviderIds.openrouter:
        return new OpenRouterProvider();
      
      case ProviderIds.googleAIStudio:
        return new GoogleAIStudioProvider(
          settings.googleAIEndpoint === "native"
        );
      
      case ProviderIds.cohere:
        return new CohereProvider();
      
      case ProviderIds.huggingface:
        return new HuggingFaceProvider();
      
      default:
        return undefined;
    }
  }

  static createAllProviders(settings: LLMProviderSettings = {}): Record<string, LLMProvider> {
    const providers: Record<string, LLMProvider> = {};
    
    const googleAIStudioProvider = new GoogleAIStudioProvider(
      settings.googleAIEndpoint === "native",
    );
    
    providers[ProviderIds.googleAIStudio] = googleAIStudioProvider;
    providers[ProviderIds.zai] = new ZAiProvider(settings.zaiBaseUrl);
    providers[ProviderIds.openrouter] = new OpenRouterProvider();
    providers[ProviderIds.cohere] = new CohereProvider();
    providers[ProviderIds.huggingface] = new HuggingFaceProvider();
    
    return providers;
  }
}