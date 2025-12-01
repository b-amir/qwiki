import { EventBus } from "@/events/EventBus";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { ProjectIndexService } from "@/infrastructure/services";
import { WorkspaceStructureCacheService } from "@/infrastructure/services";
import { ContextAnalysisService } from "@/application/services/context/ContextAnalysisService";
import { CachedProjectContextService } from "@/application/services/context/project/CachedProjectContextService";
import { ProviderSelectionService } from "@/application/services/providers/ProviderSelectionService";
import { ProjectTypeDetectionService } from "@/application/services/context/project/ProjectTypeDetectionService";
import { FileRelevanceAnalysisService } from "@/application/services/context/relevance/FileRelevanceAnalysisService";
import { FileRelevanceBatchService } from "@/application/services/context/relevance/FileRelevanceBatchService";
import { FileSelectionService } from "@/application/services/context/relevance/FileSelectionService";
import { ContextSuggestionService } from "@/application/services/context/ContextSuggestionService";
import { CachingService } from "@/infrastructure/services";
import { PerformanceMonitorService } from "@/infrastructure/services";
import { LLMRegistry } from "@/llm/providers/registry";
import { ProviderCapabilities } from "@/llm/types/ProviderCapabilities";
import { LoadingSteps, type LoadingStep } from "@/constants/loading";
import type { TokenBudget, OptimalContextSelection } from "@/domain/entities/ContextIntelligence";
import type { ProjectContext } from "@/domain/entities/Selection";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";
import { TokenBudgetCalculator } from "@/application/services/context/orchestration/TokenBudgetCalculator";
import { ContextSelectionOrchestrator } from "@/application/services/context/orchestration/ContextSelectionOrchestrator";

export class ContextIntelligenceService {
  private logger: Logger;
  private tokenBudgetCalculator: TokenBudgetCalculator;
  private selectionOrchestrator: ContextSelectionOrchestrator;

  constructor(
    private contextAnalysisService: ContextAnalysisService,
    private cachedProjectContextService: CachedProjectContextService,
    private providerSelectionService: ProviderSelectionService,
    private projectTypeDetectionService: ProjectTypeDetectionService,
    private fileRelevanceAnalysisService: FileRelevanceAnalysisService,
    private fileRelevanceBatchService: FileRelevanceBatchService,
    private fileSelectionService: FileSelectionService,
    private cachingService: CachingService,
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private performanceMonitorService: PerformanceMonitorService,
    private eventBus: EventBus,
    private loggingService: LoggingService,
    private llmRegistry: LLMRegistry,
    private projectIndexService: ProjectIndexService,
    private contextSuggestionService?: ContextSuggestionService,
  ) {
    this.logger = createLogger("ContextIntelligenceService");
    this.tokenBudgetCalculator = new TokenBudgetCalculator();
    this.selectionOrchestrator = new ContextSelectionOrchestrator(
      contextAnalysisService,
      cachedProjectContextService,
      providerSelectionService,
      projectTypeDetectionService,
      fileRelevanceAnalysisService,
      fileRelevanceBatchService,
      fileSelectionService,
      workspaceStructureCache,
      performanceMonitorService,
      eventBus,
      loggingService,
      llmRegistry,
      projectIndexService,
    );
  }

  calculateTokenBudget(
    capabilities: ProviderCapabilities,
    promptTemplateSize: number = 500,
    outputEstimate: number = 1000,
  ): TokenBudget {
    return this.tokenBudgetCalculator.calculateTokenBudget(
      capabilities,
      promptTemplateSize,
      outputEstimate,
    );
  }

  async selectOptimalContext(
    targetFilePath: string,
    providerId: string,
    model?: string,
    onProgress?: (step: LoadingStep) => void,
    snippet?: string,
  ): Promise<OptimalContextSelection> {
    const provider = this.llmRegistry.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    let capabilities: ProviderCapabilities;
    if (provider.getModelCapabilities && model) {
      this.logger.debug("Getting model-specific capabilities", { model });
      capabilities = provider.getModelCapabilities(model);
    } else {
      this.logger.debug("Using default provider capabilities");
      capabilities = provider.capabilities;
    }

    onProgress?.(LoadingSteps.calculatingTokenBudget);
    let tokenBudget = this.calculateTokenBudget(capabilities);

    if (snippet) {
      const complexity = this.analyzeSnippetComplexity(snippet);
      tokenBudget = this.calculateAdaptiveTokenBudget(snippet, tokenBudget, complexity);
      this.logger.debug("Adaptive token budget calculated", {
        complexity,
        originalBudget: this.calculateTokenBudget(capabilities).availableForContext,
        adjustedBudget: tokenBudget.availableForContext,
      });
    }

    onProgress?.(LoadingSteps.validatingProvider);
    return this.selectionOrchestrator.selectOptimalContext(
      targetFilePath,
      providerId,
      model,
      tokenBudget,
      onProgress,
    );
  }

  private analyzeSnippetComplexity(snippet: string): "low" | "medium" | "high" {
    const lines = snippet.split("\n").length;
    const functions = (snippet.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(/g) || [])
      .length;
    const classes = (snippet.match(/class\s+\w+/g) || []).length;
    const asyncPatterns = (snippet.match(/async\s+|await\s+/g) || []).length;
    const complexity = lines + functions * 10 + classes * 20 + asyncPatterns * 5;

    if (complexity < 50) return "low";
    if (complexity < 150) return "medium";
    return "high";
  }

  private calculateAdaptiveTokenBudget(
    snippet: string,
    baseBudget: TokenBudget,
    complexity: "low" | "medium" | "high",
  ): TokenBudget {
    let multiplier = 1.0;
    switch (complexity) {
      case "high":
        multiplier = 1.2;
        break;
      case "medium":
        multiplier = 1.0;
        break;
      case "low":
        multiplier = 0.8;
        break;
    }

    return {
      ...baseBudget,
      availableForContext: Math.floor(baseBudget.availableForContext * multiplier),
      totalTokens: Math.floor(baseBudget.totalTokens * multiplier),
    };
  }

  analyzeContextSuggestions(request: WikiGenerationRequest, projectContext: ProjectContext) {
    if (!this.contextSuggestionService) {
      return null;
    }

    return this.contextSuggestionService.analyzeContext(request, projectContext);
  }
}
