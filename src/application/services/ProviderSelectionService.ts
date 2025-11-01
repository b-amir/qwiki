import { LLMRegistry } from "../../llm/providers/registry";
import {
  ProviderFeature,
  CapabilityRequirement,
  ProviderCapabilities,
} from "../../llm/types/ProviderCapabilities";
import { GenerateParams } from "../../llm/types";
import { SmartProviderSelectionService } from "./SmartProviderSelectionService";
import { ProviderFallbackManagerService } from "./ProviderFallbackManagerService";
import { DeepContextAnalysis, ContextAnalysisService } from "./ContextAnalysisService";
import { EventBus } from "../../events/EventBus";
import { ProviderHealthService } from "../../infrastructure/services/ProviderHealthService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export interface GenerationContext {
  snippet: string;
  languageId?: string;
  filePath?: string;
  project?: {
    rootName?: string;
    overview?: string;
    filesSample?: string[];
    related?: Array<{
      path: string;
      preview?: string;
      line?: number;
      reason?: string;
    }>;
  };
}

export interface ProviderRanking {
  providerId: string;
  score: number;
  capabilities: ProviderCapabilities;
  responseTime?: number;
  successRate?: number;
}

export class ProviderSelectionService {
  private smartProviderSelectionService: SmartProviderSelectionService;
  private providerFallbackManager: ProviderFallbackManagerService;
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
    private contextAnalysisService: ContextAnalysisService,
    private providerHealthService: ProviderHealthService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProviderSelectionService", loggingService);
    this.smartProviderSelectionService = new SmartProviderSelectionService(
      this,
      this.contextAnalysisService,
      this.llmRegistry,
      this.eventBus,
      this.loggingService,
    );
    this.providerFallbackManager = new ProviderFallbackManagerService(
      this.smartProviderSelectionService,
      this.providerHealthService,
      this.llmRegistry,
      this.eventBus,
      this.loggingService,
    );
  }

  selectProviderForContext(context: GenerationContext): string[] {
    this.logger.debug("Selecting provider for context", {
      languageId: context.languageId,
      filePath: context.filePath,
    });
    const providers = this.llmRegistry.getAllProviders();
    const providerIds = Object.keys(providers);
    const requirements = this.analyzeContextRequirements(context);
    const suitableProviders = this.filterProvidersByRequirements(providerIds, requirements);
    const rankedProviders = this.rankProvidersBySuitability(suitableProviders, context);
    const selected = rankedProviders.map((p) => p.providerId);
    this.logger.debug("Provider selection completed", { selectedProviders: selected });
    return selected;
  }

  getBestProvider(requirements: CapabilityRequirement): string {
    const providers = this.llmRegistry.getAllProviders();
    const providerIds = Object.keys(providers);
    const suitableProviders = this.filterProvidersByRequirements(providerIds, requirements);

    if (suitableProviders.length === 0) {
      throw new Error("No provider found that meets the specified requirements");
    }

    return suitableProviders[0].providerId;
  }

  filterProvidersByCapability(capability: ProviderFeature): string[] {
    const providers = this.llmRegistry.getAllProviders();
    const providerIds = Object.keys(providers);
    const filtered = providerIds.filter((providerId) => {
      const provider = this.llmRegistry.getProvider(providerId);
      return provider && provider.supportsCapability(capability);
    });

    return filtered;
  }

  rankProvidersByPerformance(): string[] {
    const providers = this.llmRegistry.getAllProviders();
    const providerIds = Object.keys(providers);
    const rankings: ProviderRanking[] = [];

    for (const providerId of providerIds) {
      const provider = this.llmRegistry.getProvider(providerId);
      if (provider) {
        rankings.push({
          providerId,
          score: this.calculateProviderScore(provider),
          capabilities: provider.capabilities,
        });
      }
    }

    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((r) => r.providerId);
  }

  private analyzeContextRequirements(context: GenerationContext): CapabilityRequirement {
    const requirements: CapabilityRequirement = {
      requiredFeatures: [ProviderFeature.CODE_ANALYSIS, ProviderFeature.DOCUMENTATION_GENERATION],
      preferredLanguages: context.languageId ? [context.languageId] : undefined,
    };

    if (context.project && context.project.related && context.project.related.length > 5) {
      requirements.requiredFeatures.push(ProviderFeature.CONTEXT_AWARENESS);
      requirements.minContextWindow = 8192;
    }

    if (context.snippet && context.snippet.length > 2000) {
      requirements.minTokens = 4096;
    }

    return requirements;
  }

  private filterProvidersByRequirements(
    providers: string[],
    requirements: CapabilityRequirement,
  ): ProviderRanking[] {
    const suitable: ProviderRanking[] = [];

    for (const providerId of providers) {
      const provider = this.llmRegistry.getProvider(providerId);
      if (!provider) continue;

      const meetsRequirements = this.checkProviderMeetsRequirements(provider, requirements);
      if (meetsRequirements.isValid) {
        suitable.push({
          providerId,
          score: this.calculateSuitabilityScore(provider, requirements),
          capabilities: provider.capabilities,
        });
      }
    }

    return suitable.sort((a, b) => b.score - a.score);
  }

  private checkProviderMeetsRequirements(
    provider: any,
    requirements: CapabilityRequirement,
  ): { isValid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const capabilities = provider.capabilities as ProviderCapabilities;
    const featuresSet = new Set(capabilities.features);
    const supportedLanguagesSet = new Set(capabilities.supportedLanguages || []);

    for (const feature of requirements.requiredFeatures) {
      if (!featuresSet.has(feature)) {
        reasons.push(`Missing required feature: ${feature}`);
      }
    }

    if (requirements.minTokens && capabilities.maxTokens < requirements.minTokens) {
      reasons.push(
        `Insufficient max tokens: ${capabilities.maxTokens} < ${requirements.minTokens}`,
      );
    }

    if (
      requirements.minContextWindow &&
      capabilities.contextWindowSize < requirements.minContextWindow
    ) {
      reasons.push(
        `Insufficient context window: ${capabilities.contextWindowSize} < ${requirements.minContextWindow}`,
      );
    }

    if (requirements.requiresStreaming && !capabilities.streaming) {
      reasons.push("Streaming not supported");
    }

    if (requirements.requiresFunctionCalling && !capabilities.functionCalling) {
      reasons.push("Function calling not supported");
    }

    if (requirements.preferredLanguages && requirements.preferredLanguages.length > 0) {
      const preferredLanguagesSet = new Set(requirements.preferredLanguages);
      const hasPreferredLanguage = Array.from(preferredLanguagesSet).some((lang) =>
        supportedLanguagesSet.has(lang),
      );
      if (!hasPreferredLanguage) {
        reasons.push("No preferred languages supported");
      }
    }

    return {
      isValid: reasons.length === 0,
      reasons,
    };
  }

  private calculateSuitabilityScore(provider: any, requirements: CapabilityRequirement): number {
    const capabilities = provider.capabilities as ProviderCapabilities;
    let score = 0;
    const featuresSet = new Set(capabilities.features);
    const supportedLanguagesSet = new Set(capabilities.supportedLanguages || []);

    for (const feature of requirements.requiredFeatures) {
      if (featuresSet.has(feature)) {
        score += 20;
      }
    }

    if (requirements.minTokens && capabilities.maxTokens >= requirements.minTokens) {
      score += Math.min(10, (capabilities.maxTokens - requirements.minTokens) / 100);
    }

    if (
      requirements.minContextWindow &&
      capabilities.contextWindowSize >= requirements.minContextWindow
    ) {
      score += Math.min(
        10,
        (capabilities.contextWindowSize - requirements.minContextWindow) / 1000,
      );
    }

    if (requirements.preferredLanguages && requirements.preferredLanguages.length > 0) {
      const preferredLanguagesSet = new Set(requirements.preferredLanguages);
      let supportedPreferredCount = 0;
      for (const lang of preferredLanguagesSet) {
        if (supportedLanguagesSet.has(lang)) {
          supportedPreferredCount++;
        }
      }
      score += (supportedPreferredCount / requirements.preferredLanguages.length) * 15;
    }

    score += capabilities.rateLimitPerMinute / 10;

    return score;
  }

  private calculateProviderScore(provider: any): number {
    const capabilities = provider.capabilities as ProviderCapabilities;
    let score = 0;

    score += capabilities.features.length * 5;
    score += capabilities.maxTokens / 100;
    score += capabilities.contextWindowSize / 1000;
    score += capabilities.rateLimitPerMinute / 10;

    if (capabilities.streaming) score += 10;
    if (capabilities.functionCalling) score += 10;

    return score;
  }

  private rankProvidersBySuitability(
    providers: ProviderRanking[],
    context: GenerationContext,
  ): ProviderRanking[] {
    return providers.sort((a, b) => {
      const aScore = this.calculateContextualScore(a, context);
      const bScore = this.calculateContextualScore(b, context);
      return bScore - aScore;
    });
  }

  private calculateContextualScore(provider: ProviderRanking, context: GenerationContext): number {
    let score = provider.score;
    const supportedLanguagesSet = new Set(provider.capabilities.supportedLanguages || []);

    if (context.languageId && supportedLanguagesSet.has(context.languageId)) {
      score += 25;
    }

    if (context.project && context.project.related && context.project.related.length > 10) {
      if (provider.capabilities.contextWindowSize > 16000) {
        score += 15;
      }
    }

    if (context.snippet && context.snippet.length > 5000) {
      if (provider.capabilities.maxTokens > 8000) {
        score += 10;
      }
    }

    return score;
  }
}
