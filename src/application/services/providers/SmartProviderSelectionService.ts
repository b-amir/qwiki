import { EventBus } from "@/events/EventBus";
import { ProviderSelectionService } from "@/application/services/providers/ProviderSelectionService";
import {
  ContextAnalysisService,
  DeepContextAnalysis,
} from "@/application/services/context/ContextAnalysisService";
import { LLMRegistry } from "@/llm/providers/registry";
import { ServiceLimits } from "@/constants";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { RequirementsAnalyzer } from "@/application/services/providers/selection/RequirementsAnalyzer";
import { ProviderScoringService } from "@/application/services/providers/selection/ProviderScoringService";
import { ProviderRankingService } from "@/application/services/providers/selection/ProviderRankingService";
import { ProviderPerformanceTracker } from "@/application/services/providers/selection/ProviderPerformanceTracker";

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
  requiredFeatures: string[];
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
  private requirementsAnalyzer: RequirementsAnalyzer;
  private scoringService: ProviderScoringService;
  private rankingService: ProviderRankingService;
  private performanceTracker: ProviderPerformanceTracker;

  constructor(
    private providerSelectionService: ProviderSelectionService,
    private contextAnalysisService: ContextAnalysisService,
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("SmartProviderSelectionService");
    this.requirementsAnalyzer = new RequirementsAnalyzer();
    this.scoringService = new ProviderScoringService(this.llmRegistry);
    this.rankingService = new ProviderRankingService();
    this.performanceTracker = new ProviderPerformanceTracker(this.llmRegistry, this.eventBus);
  }

  async selectOptimalProvider(
    context: DeepContextAnalysis,
    criteria?: SelectionCriteria,
  ): Promise<string> {
    this.logger.debug("Selecting optimal provider", { complexity: context.complexity });
    const requirements = this.requirementsAnalyzer.determineRequirements(context);
    const availableProviders = this.getAvailableProviders(criteria);
    const scoredProviders = await this.scoreProviders(availableProviders, requirements, context);
    const rankedProviders = this.rankingService.rankProviders(scoredProviders);
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
    const performanceHistory = await this.performanceTracker.getProviderPerformance(providerId);
    return this.scoringService.scoreProvider(providerId, requirements, context, performanceHistory);
  }

  determineRequirements(context: DeepContextAnalysis): ContextualRequirements {
    return this.requirementsAnalyzer.determineRequirements(context);
  }

  async getProviderPerformance(
    providerId: string,
  ): Promise<{ averageResponseTime: number; successRate: number } | null> {
    return this.performanceTracker.getProviderPerformance(providerId);
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
    return this.performanceTracker.learnFromSelectionOutcomes(selections);
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
}
