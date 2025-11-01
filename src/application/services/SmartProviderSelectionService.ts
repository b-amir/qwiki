import { EventBus } from "../../events/EventBus";
import { ProviderSelectionService } from "./ProviderSelectionService";
import {
  ContextAnalysisService,
  DeepContextAnalysis,
  PatternType,
  RelationshipType,
} from "./ContextAnalysisService";
import { LLMRegistry } from "../../llm/providers/registry";
import { ProviderCapabilities, ProviderFeature } from "../../llm/types/ProviderCapabilities";
import { ServiceLimits } from "../../constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export interface SelectionCriteria {
  weights?: {
    performance: number;
    cost: number;
    quality: number;
    speed: number;
    reliability: number;
  };
  excludeProviders?: string[];
  maxProviders?: number;
  preferFastProviders?: boolean;
}

export interface ProviderScore {
  providerId: string;
  score: number;
  reasoning: string;
  breakdown: {
    performance: number;
    cost: number;
    quality: number;
    speed: number;
    reliability: number;
  };
}

export interface ContextualRequirements {
  requiredFeatures: ProviderFeature[];
  minTokens?: number;
  preferredLanguages?: string[];
  requiresStreaming?: boolean;
  requiresFunctionCalling?: boolean;
  minContextWindow?: number;
  complexity: "simple" | "moderate" | "complex";
  domain: "general" | "technical" | "scientific" | "business";
}

export class SmartProviderSelectionService {
  private logger: Logger;

  constructor(
    private providerSelectionService: ProviderSelectionService,
    private contextAnalysisService: ContextAnalysisService,
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("SmartProviderSelectionService", loggingService);
  }

  async selectOptimalProvider(
    context: DeepContextAnalysis,
    criteria?: SelectionCriteria,
  ): Promise<string> {
    this.logger.debug("Selecting optimal provider", { complexity: context.complexity });
    const requirements = this.determineRequirements(context);
    const availableProviders = this.getAvailableProviders(criteria);
    const scoredProviders = await this.scoreProviders(availableProviders, requirements, context);
    const rankedProviders = this.rankProviders(scoredProviders);
    const selectedProvider = rankedProviders[0]?.providerId || "";

    this.logger.debug("Provider selected", {
      providerId: selectedProvider,
      score: rankedProviders[0]?.score,
    });

    this.eventBus.publish("provider-selected", {
      providerId: selectedProvider,
      requirements,
      context,
      alternatives: rankedProviders.slice(0, ServiceLimits.maxRankedProviders).map((p) => ({
        providerId: p.providerId,
        score: p.score,
        reasoning: p.reasoning,
      })),
    });

    return selectedProvider;
  }

  async scoreProvider(
    providerId: string,
    requirements: ContextualRequirements,
    context: DeepContextAnalysis,
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

    const performanceHistory = await this.getProviderPerformance(providerId);
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

  async getProviderPerformance(
    providerId: string,
  ): Promise<{ averageResponseTime: number; successRate: number } | null> {
    const provider = this.llmRegistry.getProvider(providerId);
    if (!provider) {
      return { averageResponseTime: 1000, successRate: 0.5 };
    }

    return {
      averageResponseTime: 500,
      successRate: 0.9,
    };
  }

  private determineRequirements(context: DeepContextAnalysis): ContextualRequirements {
    const requiredFeatures: ProviderFeature[] = [];
    const complexity = context.complexity.overall;

    if (context.patterns.some((p) => p.type === PatternType.FUNCTION_DECLARATION)) {
      requiredFeatures.push(ProviderFeature.FUNCTION_CALLING);
    }

    if (context.patterns.some((p) => p.type === PatternType.CLASS_DECLARATION)) {
      requiredFeatures.push(ProviderFeature.CODE_ANALYSIS);
    }

    if (context.patterns.some((p) => p.type === PatternType.INTERFACE_DECLARATION)) {
      requiredFeatures.push(ProviderFeature.MULTI_LANGUAGE);
    }

    if (
      context.relationships.some(
        (r) => r.type === RelationshipType.INHERITS || r.type === RelationshipType.IMPLEMENTS,
      )
    ) {
      requiredFeatures.push(ProviderFeature.CONTEXT_AWARENESS);
    }

    const minTokens = complexity > 0.7 ? 4000 : complexity > 0.4 ? 2000 : 1000;
    const requiresStreaming = complexity > 0.5;
    const requiresFunctionCalling = complexity > 0.6;
    const minContextWindow = complexity > 0.8 ? 16000 : 8000;

    let domain: "general" | "technical" | "scientific" | "business" = "general";
    if (context.patterns.some((p) => p.confidence > 0.8 && p.name.includes("API"))) {
      domain = "technical";
    } else if (context.patterns.some((p) => p.confidence > 0.8 && p.name.includes("Database"))) {
      domain = "business";
    } else if (context.patterns.some((p) => p.confidence > 0.8 && p.name.includes("Algorithm"))) {
      domain = "scientific";
    }

    let complexityType: "simple" | "moderate" | "complex";
    if (complexity <= 0.3) {
      complexityType = "simple";
    } else if (complexity <= 0.7) {
      complexityType = "moderate";
    } else {
      complexityType = "complex";
    }

    return {
      requiredFeatures,
      minTokens,
      preferredLanguages: [context.language],
      requiresStreaming,
      requiresFunctionCalling,
      minContextWindow,
      complexity: complexityType,
      domain,
    };
  }

  private getAvailableProviders(criteria?: SelectionCriteria): string[] {
    const allProviders = this.llmRegistry.getAllProviders();
    let availableProviders = Object.keys(allProviders);

    if (criteria?.excludeProviders) {
      availableProviders = availableProviders.filter(
        (id) => !criteria.excludeProviders!.includes(id),
      );
    }

    if (criteria?.maxProviders && availableProviders.length > criteria.maxProviders) {
      availableProviders = availableProviders.slice(0, criteria.maxProviders);
    }

    return availableProviders;
  }

  private async scoreProviders(
    providerIds: string[],
    requirements: ContextualRequirements,
    context: DeepContextAnalysis,
  ): Promise<ProviderScore[]> {
    const scores = await Promise.all(
      providerIds.map((providerId) => this.scoreProvider(providerId, requirements, context)),
    );

    return scores;
  }

  private rankProviders(scores: ProviderScore[]): ProviderScore[] {
    return scores.sort((a, b) => {
      const aTotal =
        a.breakdown.performance +
        a.breakdown.cost +
        a.breakdown.quality +
        a.breakdown.speed +
        a.breakdown.reliability;
      const bTotal =
        b.breakdown.performance +
        b.breakdown.cost +
        b.breakdown.quality +
        b.breakdown.speed +
        b.breakdown.reliability;

      if (Math.abs(aTotal - bTotal) > 0.1) {
        return bTotal - aTotal;
      }

      return bTotal - aTotal;
    });
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

  async explainSelection(
    selectedProvider: string,
    alternatives: ProviderScore[],
    context: DeepContextAnalysis,
  ): Promise<string> {
    const selected = alternatives.find((a) => a.providerId === selectedProvider);
    if (!selected) {
      return "No selection explanation available";
    }

    const primaryReasons = selected.reasoning.split(", ");
    const alternativeText = alternatives
      .slice(1, 3)
      .map((alt) => `${alt.providerId} (${alt.score}): ${alt.reasoning.substring(0, 100)}`)
      .join(" | ");

    return `Selected ${selectedProvider} because: ${primaryReasons.join(", ")}. Alternatives: ${alternativeText}`;
  }

  async learnFromSelectionOutcomes(
    selections: Array<{ providerId: string; outcome: "success" | "failure" | "timeout" }>,
  ): Promise<void> {
    for (const selection of selections) {
      const provider = this.llmRegistry.getProvider(selection.providerId);
      if (!provider) continue;

      const currentScore = await this.getProviderScore(selection.providerId);
      const adjustment =
        selection.outcome === "success" ? 5 : selection.outcome === "failure" ? -10 : -2;

      await this.updateProviderScore(selection.providerId, currentScore + adjustment);
    }
  }

  private async getProviderScore(providerId: string): Promise<number> {
    return new Promise((resolve) => {
      this.eventBus.publish("provider-score-requested", { providerId });

      this.eventBus.subscribe(
        "provider-score-response",
        (response: { providerId: string; score: number }) => {
          if (response.providerId === providerId) {
            resolve(response.score);
          }
        },
      );

      setTimeout(() => resolve(50), 5000);
    });
  }

  private async updateProviderScore(providerId: string, newScore: number): Promise<void> {
    this.eventBus.publish("provider-score-updated", { providerId, newScore });
  }
}
