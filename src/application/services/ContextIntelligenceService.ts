import { workspace } from "vscode";
import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { ProjectIndexService } from "../../infrastructure/services/ProjectIndexService";
import { WorkspaceStructureCacheService } from "../../infrastructure/services/WorkspaceStructureCacheService";
import { ContextAnalysisService, type DeepContextAnalysis } from "./ContextAnalysisService";
import { CachedProjectContextService } from "./CachedProjectContextService";
import { ProviderSelectionService } from "./ProviderSelectionService";
import { ProjectTypeDetectionService } from "./context/ProjectTypeDetectionService";
import { FileRelevanceAnalysisService } from "./context/FileRelevanceAnalysisService";
import { FileRelevanceBatchService } from "./context/FileRelevanceBatchService";
import { FileSelectionService } from "./context/FileSelectionService";
import { ContextSuggestionService } from "./context/ContextSuggestionService";
import { CachingService } from "../../infrastructure/services/CachingService";
import { PerformanceMonitorService } from "../../infrastructure/services/PerformanceMonitorService";
import { LLMRegistry } from "../../llm/providers/registry";
import { ProviderCapabilities } from "../../llm/types/ProviderCapabilities";
import { ServiceLimits } from "../../constants";
import { LoadingSteps, type LoadingStep } from "../../constants/loading";
import type {
  TokenBudget,
  FileRelevanceScore,
  OptimalContextSelection,
  ProjectEssentialFile,
  ProjectTypeDetection,
} from "../../domain/entities/ContextIntelligence";
import type { ProjectContext } from "../../domain/entities/Selection";
import type { WikiGenerationRequest } from "../../domain/entities/Wiki";

export class ContextIntelligenceService {
  private logger: Logger;

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
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  calculateTokenBudget(
    capabilities: ProviderCapabilities,
    promptTemplateSize: number = 500,
    outputEstimate: number = 1000,
  ): TokenBudget {
    const totalTokens = capabilities.contextWindowSize;
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

  async selectOptimalContext(
    targetFilePath: string,
    providerId: string,
    model?: string,
    onProgress?: (step: LoadingStep) => void,
  ): Promise<OptimalContextSelection> {
    const startTime = Date.now();
    this.logger.info("ContextIntelligenceService.selectOptimalContext STARTED", {
      targetFilePath,
      providerId,
      model,
      timestamp: new Date().toISOString(),
    });

    const endTimer = this.performanceMonitorService.startTimer("selectOptimalContext", {
      targetFilePath,
      providerId,
      model,
    });

    try {
      onProgress?.(LoadingSteps.validatingProvider);
      const providerStart = Date.now();
      this.logger.info("Getting provider", { providerId });
      const provider = this.llmRegistry.getProvider(providerId);
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }
      const providerDuration = Date.now() - providerStart;
      this.logger.info("Provider retrieved", {
        duration: providerDuration,
        providerId,
      });

      let capabilities: ProviderCapabilities;
      if (provider.getModelCapabilities && model) {
        this.logger.debug("Getting model-specific capabilities", { model });
        capabilities = provider.getModelCapabilities(model);
      } else {
        this.logger.debug("Using default provider capabilities");
        capabilities = provider.capabilities;
      }

      onProgress?.(LoadingSteps.calculatingTokenBudget);
      const tokenBudgetStart = Date.now();
      this.logger.info("Calculating token budget");
      const tokenBudget = this.calculateTokenBudget(capabilities);
      const tokenBudgetDuration = Date.now() - tokenBudgetStart;
      this.logger.info("Token budget calculated", {
        duration: tokenBudgetDuration,
        totalTokens: tokenBudget.totalTokens,
        availableForContext: tokenBudget.availableForContext,
        utilizationTarget: tokenBudget.utilizationTarget,
      });

      onProgress?.(LoadingSteps.detectingProjectType);
      const projectTypeStart = Date.now();
      this.logger.info("Entering analyzingProject phase: Detecting project type", {
        targetFilePath,
        providerId,
        model,
      });
      const projectType = await this.projectTypeDetectionService.detectProjectType();
      const projectTypeDuration = Date.now() - projectTypeStart;
      this.logger.info("Project type detected", {
        duration: projectTypeDuration,
        durationSeconds: Math.round(projectTypeDuration / 1000),
        primaryLanguage: projectType.primaryLanguage,
        framework: projectType.framework,
        buildSystem: projectType.buildSystem,
        packageManager: projectType.packageManager,
        confidence: projectType.confidence,
      });

      const essentialFilesStart = Date.now();
      this.logger.debug("Getting language-specific essentials");
      const essentialFiles =
        await this.projectTypeDetectionService.getLanguageSpecificEssentials(projectType);
      this.logger.debug("Essential files retrieved", {
        duration: Date.now() - essentialFilesStart,
        essentialFileCount: essentialFiles.length,
      });

      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace folder found");
      }

      const findFilesStart = Date.now();
      const maxFiles = ServiceLimits.contextIntelligenceMaxFileAnalysis;
      this.logger.info("Getting indexed files", { maxFiles });
      const indexedFiles = await this.projectIndexService.getIndexedFiles();
      const allFiles = indexedFiles.slice(0, maxFiles).map((f) => f.uri);
      const findFilesDuration = Date.now() - findFilesStart;
      this.logger.info("Indexed files retrieved", {
        duration: findFilesDuration,
        fileCount: allFiles.length,
      });

      if (indexedFiles.length >= maxFiles) {
        this.logger.warn("File limit reached - only analyzing first files", {
          totalFiles: indexedFiles.length,
          limit: maxFiles,
        });
      }

      onProgress?.(LoadingSteps.analyzingFileRelevance);
      const fileRelevanceScores =
        await this.fileRelevanceBatchService.getOrAnalyzeFileRelevanceScores(
          targetFilePath,
          allFiles,
          projectType,
          onProgress,
        );

      const sortStart = Date.now();
      fileRelevanceScores.sort((a, b) => b.score - a.score);
      this.logger.debug("File relevance scores sorted", {
        duration: Date.now() - sortStart,
        topScore: fileRelevanceScores[0]?.score,
        topFile: fileRelevanceScores[0]?.filePath,
      });

      const availableTokens = tokenBudget.availableForContext * tokenBudget.utilizationTarget;
      onProgress?.(LoadingSteps.optimizingContextSelection);
      const selectionResult = this.fileSelectionService.selectFilesByTokenBudget(
        fileRelevanceScores,
        availableTokens,
        tokenBudget.utilizationTarget,
      );

      const essentialResult = this.fileSelectionService.addEssentialFiles(
        essentialFiles,
        selectionResult.selectedFiles,
        selectionResult.totalTokenCost,
        availableTokens,
      );
      const selectedFiles = essentialResult.selectedFiles;
      const totalTokenCost = essentialResult.totalTokenCost;
      const excludedFiles = selectionResult.excludedFiles;

      const utilizationRate = totalTokenCost / tokenBudget.availableForContext;

      const selection: OptimalContextSelection = {
        selectedFiles,
        essentialFiles,
        totalTokenCost,
        utilizationRate,
        excludedFiles,
        compressionApplied: false,
      };

      this.logger.debug("Publishing context-selected event");
      await this.eventBus.publish("context-selected", {
        targetFilePath,
        providerId,
        selection,
        tokenBudget,
      });

      this.logger.debug("Publishing project-type-detected event");
      await this.eventBus.publish("project-type-detected", projectType);

      endTimer();
      const totalDuration = Date.now() - startTime;
      this.logger.info("ContextIntelligenceService.selectOptimalContext COMPLETED", {
        totalDuration,
        totalDurationSeconds: Math.round(totalDuration / 1000),
        selectedFileCount: selectedFiles.length,
        excludedFileCount: excludedFiles.length,
        totalTokenCost,
        utilizationRate: Math.round(utilizationRate * 100),
      });
      return selection;
    } catch (error) {
      endTimer();
      this.logError("Failed to select optimal context", {
        error,
        totalDuration: Date.now() - startTime,
      });
      throw error;
    }
  }

  analyzeContextSuggestions(request: WikiGenerationRequest, projectContext: ProjectContext) {
    if (!this.contextSuggestionService) {
      return null;
    }

    return this.contextSuggestionService.analyzeContext(request, projectContext);
  }
}
