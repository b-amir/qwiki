import { workspace } from "vscode";
import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { ContextAnalysisService, type DeepContextAnalysis } from "./ContextAnalysisService";
import { CachedProjectContextService } from "./CachedProjectContextService";
import { ProviderSelectionService } from "./ProviderSelectionService";
import { ProjectTypeDetectionService } from "./context/ProjectTypeDetectionService";
import { FileRelevanceAnalysisService } from "./context/FileRelevanceAnalysisService";
import { CachingService } from "../../infrastructure/services/CachingService";
import { PerformanceMonitorService } from "../../infrastructure/services/PerformanceMonitorService";
import { LLMRegistry } from "../../llm/providers/registry";
import { ProviderCapabilities } from "../../llm/types/ProviderCapabilities";
import { ServiceLimits, FilePatterns } from "../../constants";
import { LoadingSteps, type LoadingStep } from "../../constants/loading";
import type {
  TokenBudget,
  FileRelevanceScore,
  OptimalContextSelection,
  ProjectEssentialFile,
  ProjectTypeDetection,
} from "../../domain/entities/ContextIntelligence";

export class ContextIntelligenceService {
  private logger: Logger;

  constructor(
    private contextAnalysisService: ContextAnalysisService,
    private cachedProjectContextService: CachedProjectContextService,
    private providerSelectionService: ProviderSelectionService,
    private projectTypeDetectionService: ProjectTypeDetectionService,
    private fileRelevanceAnalysisService: FileRelevanceAnalysisService,
    private cachingService: CachingService,
    private performanceMonitorService: PerformanceMonitorService,
    private eventBus: EventBus,
    private loggingService: LoggingService,
    private llmRegistry: LLMRegistry,
  ) {
    this.logger = createLogger("ContextIntelligenceService", loggingService);
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
      const providerStart = Date.now();
      this.logger.info("Getting provider", { providerId });
      onProgress?.(LoadingSteps.analyzingProject);
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

      const tokenBudgetStart = Date.now();
      this.logger.info("Calculating token budget");
      onProgress?.(LoadingSteps.analyzingProject);
      const tokenBudget = this.calculateTokenBudget(capabilities);
      const tokenBudgetDuration = Date.now() - tokenBudgetStart;
      this.logger.info("Token budget calculated", {
        duration: tokenBudgetDuration,
        totalTokens: tokenBudget.totalTokens,
        availableForContext: tokenBudget.availableForContext,
        utilizationTarget: tokenBudget.utilizationTarget,
      });

      const projectTypeStart = Date.now();
      this.logger.info("Entering analyzingProject phase: Detecting project type", {
        targetFilePath,
        providerId,
        model,
      });
      onProgress?.(LoadingSteps.analyzingProject);
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
      this.logger.info("Finding all project files", { maxFiles: 200 });
      onProgress?.(LoadingSteps.analyzingProject);
      const allFiles = await workspace.findFiles(FilePatterns.allFiles, FilePatterns.exclude, 200);
      const findFilesDuration = Date.now() - findFilesStart;
      this.logger.info("All files found", {
        duration: findFilesDuration,
        fileCount: allFiles.length,
      });

      if (allFiles.length >= 200) {
        this.logger.warn("File limit reached - only analyzing first 200 files", {
          totalFiles: allFiles.length,
          limit: 200,
        });
      }

      const fileRelevanceScores: FileRelevanceScore[] = [];
      const analyzeStart = Date.now();
      let analyzedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const totalFilesToAnalyze = allFiles.length;
      const progressInterval = 10; // Update progress every 10 files
      const logInterval = 20; // Log every 20 files

      this.logger.info("Starting file relevance analysis", {
        totalFiles: totalFilesToAnalyze,
        targetFilePath,
        progressUpdateInterval: progressInterval,
      });
      onProgress?.(LoadingSteps.analyzingProject);

      for (const fileUri of allFiles) {
        const filePath = fileUri.fsPath;
        if (filePath === targetFilePath) {
          skippedCount++;
          continue;
        }

        try {
          analyzedCount++;

          // Update progress periodically to keep UI responsive
          if (analyzedCount % progressInterval === 0) {
            onProgress?.(LoadingSteps.analyzingProject);
            const elapsed = Date.now() - analyzeStart;
            const avgTimePerFile = elapsed / analyzedCount;
            const estimatedRemaining = avgTimePerFile * (totalFilesToAnalyze - analyzedCount);

            const progressData = {
              analyzed: analyzedCount,
              total: totalFilesToAnalyze,
              skipped: skippedCount,
              errors: errorCount,
              scoresFound: fileRelevanceScores.length,
              progressPercent: Math.round((analyzedCount / totalFilesToAnalyze) * 100),
              elapsedSeconds: Math.round(elapsed / 1000),
              estimatedRemainingSeconds: Math.round(estimatedRemaining / 1000),
              avgMsPerFile: Math.round(avgTimePerFile),
            };

            this.logger.info(
              `Context gathering progress: ${progressData.progressPercent}% (${progressData.analyzed}/${progressData.total} files analyzed)`,
              progressData,
            );
          } else if (analyzedCount % logInterval === 0) {
            // Less frequent detailed logging
            this.logger.debug("File relevance analysis progress", {
              analyzed: analyzedCount,
              total: totalFilesToAnalyze,
              progressPercent: Math.round((analyzedCount / totalFilesToAnalyze) * 100),
            });
          }

          const fileAnalysisStart = Date.now();
          const relevanceScore = await this.fileRelevanceAnalysisService.analyzeFileRelevance(
            targetFilePath,
            filePath,
            projectType,
          );
          const fileAnalysisDuration = Date.now() - fileAnalysisStart;

          if (fileAnalysisDuration > 1000) {
            // Log slow file analysis
            this.logger.debug("Slow file analysis detected", {
              filePath,
              duration: fileAnalysisDuration,
            });
          }

          fileRelevanceScores.push(relevanceScore);
        } catch (error) {
          errorCount++;
          this.logError(`Failed to analyze file relevance for ${filePath}`, {
            error,
            filePath,
            analyzedCount,
            totalFiles: totalFilesToAnalyze,
          });
        }
      }

      const analysisDuration = Date.now() - analyzeStart;
      this.logger.info("File relevance analysis COMPLETED", {
        duration: analysisDuration,
        durationSeconds: Math.round(analysisDuration / 1000),
        analyzed: analyzedCount,
        skipped: skippedCount,
        errors: errorCount,
        scoresFound: fileRelevanceScores.length,
        averageTimePerFile: Math.round(analysisDuration / Math.max(analyzedCount, 1)),
      });

      const sortStart = Date.now();
      fileRelevanceScores.sort((a, b) => b.score - a.score);
      this.logger.debug("File relevance scores sorted", {
        duration: Date.now() - sortStart,
        topScore: fileRelevanceScores[0]?.score,
        topFile: fileRelevanceScores[0]?.filePath,
      });

      const selectedFiles: FileRelevanceScore[] = [];
      const excludedFiles: FileRelevanceScore[] = [];
      let totalTokenCost = 0;
      const availableTokens = tokenBudget.availableForContext * tokenBudget.utilizationTarget;

      const selectStart = Date.now();
      this.logger.info("Selecting files based on token budget", {
        availableTokens,
        utilizationTarget: tokenBudget.utilizationTarget,
        filesToConsider: fileRelevanceScores.length,
      });
      for (const fileScore of fileRelevanceScores) {
        if (totalTokenCost + fileScore.tokenCost <= availableTokens) {
          selectedFiles.push(fileScore);
          totalTokenCost += fileScore.tokenCost;
        } else {
          excludedFiles.push(fileScore);
        }
      }
      const selectDuration = Date.now() - selectStart;
      this.logger.info("File selection completed", {
        duration: selectDuration,
        selectedCount: selectedFiles.length,
        excludedCount: excludedFiles.length,
        totalTokenCost,
        tokenUtilization: Math.round((totalTokenCost / availableTokens) * 100),
      });

      const essentialStart = Date.now();
      this.logger.debug("Adding essential files", { essentialCount: essentialFiles.length });
      for (const essential of essentialFiles) {
        const alreadyIncluded = selectedFiles.some((f) => f.filePath === essential.filePath);
        if (!alreadyIncluded && totalTokenCost + essential.tokenCost <= availableTokens) {
          const essentialScore: FileRelevanceScore = {
            filePath: essential.filePath,
            score: 100,
            relevanceType: "essential",
            tokenCost: essential.tokenCost,
            compressionRatio: 0.5,
            metadata: {
              isDependency: false,
              isImportedBy: [],
              importsFrom: [],
              semanticSimilarity: 1.0,
              lastModified: new Date(),
              complexity: 0,
              fileCategory: essential.contentType === "package-manager" ? "config" : "source",
            },
          };
          selectedFiles.push(essentialScore);
          totalTokenCost += essential.tokenCost;
        }
      }
      this.logger.debug("Essential files processed", {
        duration: Date.now() - essentialStart,
        finalSelectedCount: selectedFiles.length,
        finalTokenCost: totalTokenCost,
      });

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
}
