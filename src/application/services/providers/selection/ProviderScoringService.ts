import { LLMRegistry } from "@/llm/providers/registry";
import { ProviderCapabilities } from "@/llm/types/ProviderCapabilities";
import type { DeepContextAnalysis } from "@/application/services/context/ContextAnalysisService";
import type {
  ContextualRequirements,
  ProviderScore,
} from "@/application/services/providers/SmartProviderSelectionService";

export class ProviderScoringService {
  constructor(private llmRegistry: LLMRegistry) {}

  async scoreProvider(
    providerId: string,
    requirements: ContextualRequirements,
    context: DeepContextAnalysis,
    performanceHistory?: { averageResponseTime: number; successRate: number } | null,
  ): Promise<ProviderScore> {
    const provider = this.llmRegistry.getProvider(providerId);
    if (!provider) {
      return {
        providerId,
        score: 0,
        reasoning: "Provider not found",
        breakdown: { performance: 0, cost: 0, quality: 0, speed: 0, reliability: 0 },
      };
    }

    const capabilities = provider.capabilities;
    let score = 0;
    const breakdown = { performance: 0, cost: 0, quality: 0, speed: 0, reliability: 0 };

    for (const feature of requirements.requiredFeatures) {
      if (provider.supportsCapability(feature)) {
        score += 20;
      }
    }

    if (requirements.minTokens && capabilities.maxTokens >= requirements.minTokens) {
      score += 15;
    }

    if (requirements.preferredLanguages && requirements.preferredLanguages.length > 0) {
      const supportedLanguagesSet = new Set(capabilities.supportedLanguages || []);
      const preferredLanguagesSet = new Set(requirements.preferredLanguages);
      for (const lang of preferredLanguagesSet) {
        if (supportedLanguagesSet.has(lang)) {
          score += 10;
          break;
        }
      }
    }

    if (requirements.requiresStreaming && capabilities.streaming) {
      score += 15;
    }

    if (requirements.requiresFunctionCalling && capabilities.functionCalling) {
      score += 15;
    }

    if (
      requirements.minContextWindow &&
      capabilities.contextWindowSize >= requirements.minContextWindow
    ) {
      score += 10;
    }

    const complexityBonus = this.getComplexityBonus(
      context.complexity.overall,
      requirements.complexity,
    );
    score += complexityBonus;

    if (performanceHistory) {
      const avgResponseTime = performanceHistory.averageResponseTime || 1000;
      const successRate = performanceHistory.successRate || 0.5;

      if (avgResponseTime < 500) {
        breakdown.performance += 20;
        score += 10;
      }

      if (successRate > 0.9) {
        breakdown.reliability += 20;
        score += 10;
      }
    }

    return {
      providerId,
      score,
      reasoning: this.generateReasoning(capabilities, requirements, breakdown, context),
      breakdown,
    };
  }

  private getComplexityBonus(overallComplexity: number, requiredComplexity: string): number {
    if (requiredComplexity === "simple" && overallComplexity <= 0.3) return 15;
    if (requiredComplexity === "simple" && overallComplexity <= 0.6) return 10;
    if (requiredComplexity === "moderate" && overallComplexity <= 0.5) return 20;
    if (requiredComplexity === "moderate" && overallComplexity <= 0.7) return 15;
    if (requiredComplexity === "complex") return 25;

    return 0;
  }

  private generateReasoning(
    capabilities: ProviderCapabilities,
    requirements: ContextualRequirements,
    breakdown: any,
    context: DeepContextAnalysis,
  ): string {
    const reasons: string[] = [];

    if (breakdown.performance > 0) {
      reasons.push("Strong performance metrics");
    }

    if (breakdown.cost > 0) {
      reasons.push("Cost-effective operation");
    }

    if (breakdown.quality > 0) {
      reasons.push("High quality output");
    }

    if (capabilities.streaming && requirements.requiresStreaming) {
      reasons.push("Streaming support available");
    }

    if (capabilities.functionCalling && requirements.requiresFunctionCalling) {
      reasons.push("Function calling capability");
    }

    if (context.patterns.length > 10) {
      reasons.push("Handles complex code structure");
    }

    if (requirements.minTokens && capabilities.maxTokens >= requirements.minTokens) {
      reasons.push("Sufficient token limit");
    }

    return reasons.join(", ");
  }
}
