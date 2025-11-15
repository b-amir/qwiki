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
    const tokenBudget = this.calculateTokenBudget(capabilities);

    onProgress?.(LoadingSteps.validatingProvider);
    return this.selectionOrchestrator.selectOptimalContext(
      targetFilePath,
      providerId,
      model,
      tokenBudget,
      onProgress,
    );
  }

  analyzeContextSuggestions(request: WikiGenerationRequest, projectContext: ProjectContext) {
    if (!this.contextSuggestionService) {
      return null;
    }

    return this.contextSuggestionService.analyzeContext(request, projectContext);
  }
}
