import type { ProviderVariants } from "@/domain/entities/PromptEngineering";

export class PromptOptimizer {
  async optimizePromptForProvider(prompt: string, provider: string): Promise<string> {
    let optimized = prompt;

    if (provider === "openrouter" || provider === "google-ai-studio") {
      optimized = optimized.replace(/NON-NEGOTIABLE/gi, "REQUIRED");
    }

    if (provider === "cohere") {
      optimized = optimized.replace(/```/g, "`");
    }

    return optimized;
  }

  async createProviderSpecificVariants(basePrompt: string): Promise<ProviderVariants> {
    const variants: ProviderVariants = {
      default: basePrompt,
    };

    variants.openrouter = basePrompt.replace(/NON-NEGOTIABLE/gi, "REQUIRED");
    variants["google-ai-studio"] = basePrompt.replace(/NON-NEGOTIABLE/gi, "REQUIRED");
    variants.cohere = basePrompt.replace(/```/g, "`");
    variants.huggingface = basePrompt.replace(/OUTPUT REQUIREMENTS/i, "Generate documentation");
    variants.zai = basePrompt;

    return variants;
  }

  async adaptPromptToLanguage(prompt: string, language: string): Promise<string> {
    let adapted = prompt;

    const languagePatterns: Record<string, { terms: string[]; conventions: string }> = {
      typescript: {
        terms: ["TypeScript", "type definitions", "interfaces", "generics"],
        conventions: "Use TypeScript-specific terminology. Mention types and interfaces.",
      },
      javascript: {
        terms: ["JavaScript", "functions", "objects", "prototypes"],
        conventions: "Use JavaScript conventions. Focus on functions and object patterns.",
      },
      python: {
        terms: ["Python", "functions", "classes", "modules", "decorators"],
        conventions: "Use Python conventions. Mention modules and decorators where relevant.",
      },
      java: {
        terms: ["Java", "classes", "methods", "packages", "interfaces"],
        conventions: "Use Java conventions. Focus on classes and packages.",
      },
    };

    const langInfo = languagePatterns[language.toLowerCase()];
    if (langInfo) {
      adapted = `${adapted}\n\nLanguage-specific guidance: ${langInfo.conventions}`;
    }

    return adapted;
  }
}
