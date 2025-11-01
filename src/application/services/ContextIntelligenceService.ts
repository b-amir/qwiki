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
  ): Promise<OptimalContextSelection> {
    const endTimer = this.performanceMonitorService.startTimer("selectOptimalContext", {
      targetFilePath,
      providerId,
      model,
    });

    try {
      const provider = this.llmRegistry.getProvider(providerId);
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`);
      }

      let capabilities: ProviderCapabilities;
      if (provider.getModelCapabilities && model) {
        capabilities = provider.getModelCapabilities(model);
      } else {
        capabilities = provider.capabilities;
      }

      const tokenBudget = this.calculateTokenBudget(capabilities);

      const projectType = await this.projectTypeDetectionService.detectProjectType();
      const essentialFiles =
        await this.projectTypeDetectionService.getLanguageSpecificEssentials(projectType);

      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace folder found");
      }

      const allFiles = await workspace.findFiles(FilePatterns.allFiles, FilePatterns.exclude, 200);

      const fileRelevanceScores: FileRelevanceScore[] = [];

      for (const fileUri of allFiles) {
        const filePath = fileUri.fsPath;
        if (filePath === targetFilePath) {
          continue;
        }

        try {
          const relevanceScore = await this.fileRelevanceAnalysisService.analyzeFileRelevance(
            targetFilePath,
            filePath,
            projectType,
          );
          fileRelevanceScores.push(relevanceScore);
        } catch (error) {
          this.logDebug(`Failed to analyze file relevance for ${filePath}`, error);
        }
      }

      fileRelevanceScores.sort((a, b) => b.score - a.score);

      const selectedFiles: FileRelevanceScore[] = [];
      const excludedFiles: FileRelevanceScore[] = [];
      let totalTokenCost = 0;
      const availableTokens = tokenBudget.availableForContext * tokenBudget.utilizationTarget;

      for (const fileScore of fileRelevanceScores) {
        if (totalTokenCost + fileScore.tokenCost <= availableTokens) {
          selectedFiles.push(fileScore);
          totalTokenCost += fileScore.tokenCost;
        } else {
          excludedFiles.push(fileScore);
        }
      }

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

      const utilizationRate = totalTokenCost / tokenBudget.availableForContext;

      const selection: OptimalContextSelection = {
        selectedFiles,
        essentialFiles,
        totalTokenCost,
        utilizationRate,
        excludedFiles,
        compressionApplied: false,
      };

      await this.eventBus.publish("context-selected", {
        targetFilePath,
        providerId,
        selection,
        tokenBudget,
      });

      await this.eventBus.publish("project-type-detected", projectType);

      endTimer();
      return selection;
    } catch (error) {
      endTimer();
      this.logError("Failed to select optimal context", error);
      throw error;
    }
  }
}
