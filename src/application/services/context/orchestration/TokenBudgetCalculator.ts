import { ProviderCapabilities } from "@/llm/types/ProviderCapabilities";
import type { TokenBudget } from "@/domain/entities/ContextIntelligence";

export class TokenBudgetCalculator {
  calculateTokenBudget(
    capabilities: ProviderCapabilities,
    promptTemplateSize: number = 500,
    outputEstimate: number = 1000,
  ): TokenBudget {
    const totalTokens = capabilities.contextWindowSize ?? 8192;
    const reservedForPrompt = promptTemplateSize;
    const reservedForOutput = outputEstimate;
    const availableForContext = totalTokens - reservedForPrompt - reservedForOutput;
    const utilizationTarget = 0.85;

    return {
      totalTokens,
      reservedForPrompt,
      reservedForOutput,
      availableForContext: Math.max(0, availableForContext),
      utilizationTarget,
    };
  }
}
