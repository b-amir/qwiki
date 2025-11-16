import { workspace, type Uri } from "vscode";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { WorkspaceStructureCacheService } from "@/infrastructure/services/caching/WorkspaceStructureCacheService";
import { FileRelevanceAnalysisService } from "@/application/services/context/relevance/FileRelevanceAnalysisService";
import { ServiceLimits } from "@/constants";
import { LoadingSteps, type LoadingStep } from "@/constants/loading";
import type {
  FileRelevanceScore,
  ProjectTypeDetection,
} from "@/domain/entities/ContextIntelligence";

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

    const concurrencyLimit = ServiceLimits.contextIntelligenceConcurrencyLimit;
    this.logger.info("Starting file relevance analysis", {
      totalFiles: totalFilesToAnalyze,
      targetFilePath,
      progressUpdateInterval: progressInterval,
      concurrencyLimit,
    });
    onProgress?.(LoadingSteps.analyzingFileRelevance);

    const filesToAnalyze = allFiles.filter((fileUri) => fileUri.fsPath !== targetFilePath);
    skippedCount = allFiles.length - filesToAnalyze.length;

    const processBatch = async (batch: Uri[]): Promise<void> => {
      const batchPromises = batch.map(async (fileUri) => {
        const filePath = fileUri.fsPath;
        try {
          const currentAnalyzed = ++analyzedCount;

          if (currentAnalyzed % progressInterval === 0) {
            onProgress?.(LoadingSteps.analyzingFileRelevance);
            const elapsed = Date.now() - analyzeStart;
            const avgTimePerFile = elapsed / currentAnalyzed;
            const estimatedRemaining = avgTimePerFile * (totalFilesToAnalyze - currentAnalyzed);

            const progressData = {
              analyzed: currentAnalyzed,
              total: totalFilesToAnalyze,
              skipped: skippedCount,
              errors: errorCount,
              scoresFound: fileRelevanceScores.length,
              progressPercent: Math.round((currentAnalyzed / totalFilesToAnalyze) * 100),
              elapsedSeconds: Math.round(elapsed / 1000),
              estimatedRemainingSeconds: Math.round(estimatedRemaining / 1000),
              avgMsPerFile: Math.round(avgTimePerFile),
            };

            if (
              progressData.progressPercent % 25 === 0 ||
              currentAnalyzed === totalFilesToAnalyze
            ) {
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
      });

      await Promise.all(batchPromises);
    };

    for (let i = 0; i < filesToAnalyze.length; i += concurrencyLimit) {
      const batch = filesToAnalyze.slice(i, i + concurrencyLimit);
      await processBatch(batch);
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
