import { workspace, type Uri } from "vscode";
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
import { PerformanceMonitorService } from "@/infrastructure/services";
import { LLMRegistry } from "@/llm/providers/registry";
import { ProviderCapabilities } from "@/llm/types/ProviderCapabilities";
import { ServiceLimits } from "@/constants";
import { LoadingSteps, type LoadingStep } from "@/constants/loading";
import type { TokenBudget, OptimalContextSelection } from "@/domain/entities/ContextIntelligence";
import { TokenBudgetCalculator } from "@/application/services/context/orchestration/TokenBudgetCalculator";

export class ContextSelectionOrchestrator {
  private logger: Logger;
  private tokenBudgetCalculator: TokenBudgetCalculator;

  constructor(
    private contextAnalysisService: ContextAnalysisService,
    private cachedProjectContextService: CachedProjectContextService,
    private providerSelectionService: ProviderSelectionService,
    private projectTypeDetectionService: ProjectTypeDetectionService,
    private fileRelevanceAnalysisService: FileRelevanceAnalysisService,
    private fileRelevanceBatchService: FileRelevanceBatchService,
    private fileSelectionService: FileSelectionService,
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private performanceMonitorService: PerformanceMonitorService,
    private eventBus: EventBus,
    loggingService: LoggingService,
    private llmRegistry: LLMRegistry,
    private projectIndexService: ProjectIndexService,
  ) {
    this.logger = createLogger("ContextSelectionOrchestrator");
    this.tokenBudgetCalculator = new TokenBudgetCalculator();
  }

  async selectOptimalContext(
    targetFilePath: string,
    providerId: string,
    model: string | undefined,
    tokenBudget: TokenBudget,
    onProgress?: (step: LoadingStep) => void,
  ): Promise<OptimalContextSelection> {
    const startTime = Date.now();
    this.logger.info("ContextSelectionOrchestrator.selectOptimalContext STARTED", {
      targetFilePath,
      providerId,
      model,
    });

    const endTimer = this.performanceMonitorService.startTimer("selectOptimalContext", {
      targetFilePath,
      providerId,
      model,
    });

    try {
      onProgress?.(LoadingSteps.detectingProjectType);
      const projectType = await this.detectProjectType(onProgress);

      const essentialFiles = await this.getEssentialFiles(projectType);

      const allFiles = await this.getIndexedFiles();

      onProgress?.(LoadingSteps.analyzingFileRelevance);
      const fileRelevanceScores = await this.analyzeFileRelevance(
        targetFilePath,
        allFiles,
        projectType,
        onProgress,
      );

      const selection = await this.selectFiles(fileRelevanceScores, essentialFiles, tokenBudget);

      await this.publishEvents(targetFilePath, providerId, selection, tokenBudget, projectType);

      endTimer();
      const totalDuration = Date.now() - startTime;
      this.logger.info("ContextSelectionOrchestrator.selectOptimalContext COMPLETED", {
        totalDuration,
        selectedFileCount: selection.selectedFiles.length,
        excludedFileCount: selection.excludedFiles.length,
        totalTokenCost: selection.totalTokenCost,
        utilizationRate: Math.round(selection.utilizationRate * 100),
      });

      return selection;
    } catch (error) {
      endTimer();
      this.logger.error("Failed to select optimal context", {
        error,
        totalDuration: Date.now() - startTime,
      });
      throw error;
    }
  }

  private async detectProjectType(onProgress?: (step: LoadingStep) => void) {
    const projectTypeStart = Date.now();
    this.logger.info("Detecting project type");
    const projectType = await this.projectTypeDetectionService.detectProjectType();
    const projectTypeDuration = Date.now() - projectTypeStart;
    this.logger.info("Project type detected", {
      duration: projectTypeDuration,
      primaryLanguage: projectType.primaryLanguage,
      framework: projectType.framework,
      confidence: projectType.confidence,
    });
    return projectType;
  }

  private async getEssentialFiles(projectType: any) {
    const essentialFilesStart = Date.now();
    this.logger.debug("Getting language-specific essentials");
    const essentialFiles =
      await this.projectTypeDetectionService.getLanguageSpecificEssentials(projectType);
    this.logger.debug("Essential files retrieved", {
      duration: Date.now() - essentialFilesStart,
      essentialFileCount: essentialFiles.length,
    });
    return essentialFiles;
  }

  private async getIndexedFiles(): Promise<Uri[]> {
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

    return allFiles;
  }

  private async analyzeFileRelevance(
    targetFilePath: string,
    allFiles: Uri[],
    projectType: any,
    onProgress?: (step: LoadingStep) => void,
  ) {
    const fileRelevanceScores =
      await this.fileRelevanceBatchService.getOrAnalyzeFileRelevanceScores(
        targetFilePath,
        allFiles,
        projectType,
        onProgress,
      );

    const sortStart = Date.now();
    fileRelevanceScores.sort((a: any, b: any) => b.score - a.score);
    this.logger.debug("File relevance scores sorted", {
      duration: Date.now() - sortStart,
      topScore: fileRelevanceScores[0]?.score,
      topFile: fileRelevanceScores[0]?.filePath,
    });

    return fileRelevanceScores;
  }

  private async selectFiles(
    fileRelevanceScores: any[],
    essentialFiles: any[],
    tokenBudget: TokenBudget,
  ): Promise<OptimalContextSelection> {
    const availableTokens = tokenBudget.availableForContext;
    const selectionResult = this.fileSelectionService.selectFilesByTokenBudget(
      fileRelevanceScores,
      availableTokens,
      tokenBudget.utilizationTarget,
      essentialFiles,
    );

    const utilizationRate = selectionResult.totalTokenCost / tokenBudget.availableForContext;

    return {
      selectedFiles: selectionResult.selectedFiles,
      essentialFiles,
      totalTokenCost: selectionResult.totalTokenCost,
      utilizationRate,
      excludedFiles: selectionResult.excludedFiles,
      compressionApplied: false,
    };
  }

  private async publishEvents(
    targetFilePath: string,
    providerId: string,
    selection: OptimalContextSelection,
    tokenBudget: TokenBudget,
    projectType: any,
  ) {
    this.logger.debug("Publishing context-selected event");
    await this.eventBus.publish("context-selected", {
      targetFilePath,
      providerId,
      selection,
      tokenBudget,
    });

    this.logger.debug("Publishing project-type-detected event");
    await this.eventBus.publish("project-type-detected", projectType);
  }
}
