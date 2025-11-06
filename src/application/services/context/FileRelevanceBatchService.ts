import { workspace, type Uri } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import { WorkspaceStructureCacheService } from "../../../infrastructure/services/WorkspaceStructureCacheService";
import { FileRelevanceAnalysisService } from "./FileRelevanceAnalysisService";
import { ServiceLimits } from "../../../constants";
import { LoadingSteps, type LoadingStep } from "../../../constants/loading";
import type {
  FileRelevanceScore,
  ProjectTypeDetection,
} from "../../../domain/entities/ContextIntelligence";

export class FileRelevanceBatchService {
  private logger: Logger;

  constructor(
    private workspaceStructureCache: WorkspaceStructureCacheService,
    private fileRelevanceAnalysisService: FileRelevanceAnalysisService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("FileRelevanceBatchService");
  }

  async getOrAnalyzeFileRelevanceScores(
    targetFilePath: string,
    allFiles: Uri[],
    projectType: ProjectTypeDetection,
    onProgress?: (step: LoadingStep) => void,
  ): Promise<FileRelevanceScore[]> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder found");
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cachedScores = await this.workspaceStructureCache.getFileRelevanceScores(targetFilePath);

    if (cachedScores) {
      this.logger.info("Using cached file relevance scores", {
        targetFilePath,
        scoreCount: cachedScores.length,
      });
      return cachedScores;
    }

    this.logger.info("No cached file relevance scores found, analyzing files", {
      totalFiles: allFiles.length,
      targetFilePath,
    });

    const fileRelevanceScores: FileRelevanceScore[] = [];
    const analyzeStart = Date.now();
    let analyzedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const totalFilesToAnalyze = allFiles.length;
    const progressInterval = ServiceLimits.contextIntelligenceProgressInterval;
    const logInterval = ServiceLimits.contextIntelligenceLogInterval;

    this.logger.info("Starting file relevance analysis", {
      totalFiles: totalFilesToAnalyze,
      targetFilePath,
      progressUpdateInterval: progressInterval,
    });
    onProgress?.(LoadingSteps.analyzingFileRelevance);

    for (const fileUri of allFiles) {
      const filePath = fileUri.fsPath;
      if (filePath === targetFilePath) {
        skippedCount++;
        continue;
      }

      try {
        analyzedCount++;

        if (analyzedCount % progressInterval === 0) {
          onProgress?.(LoadingSteps.analyzingFileRelevance);
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

          if (progressData.progressPercent % 25 === 0 || analyzedCount === totalFilesToAnalyze) {
            this.logger.info(
              `Context gathering progress: ${progressData.progressPercent}% (${progressData.analyzed}/${progressData.total} files analyzed)`,
              progressData,
            );
          }
        }

        const fileAnalysisStart = Date.now();
        const relevanceScore = await this.fileRelevanceAnalysisService.analyzeFileRelevance(
          targetFilePath,
          filePath,
          projectType,
        );
        const fileAnalysisDuration = Date.now() - fileAnalysisStart;

        if (fileAnalysisDuration > ServiceLimits.contextIntelligenceSlowAnalysisThreshold) {
          this.logger.debug("Slow file analysis detected", {
            filePath,
            duration: fileAnalysisDuration,
          });
        }

        fileRelevanceScores.push(relevanceScore);
      } catch (error) {
        errorCount++;
        this.logger.error(`Failed to analyze file relevance for ${filePath}`, {
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

    await this.workspaceStructureCache.setFileRelevanceScores(targetFilePath, fileRelevanceScores);

    return fileRelevanceScores;
  }
}
