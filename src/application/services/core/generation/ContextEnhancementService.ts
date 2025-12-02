import { CancellationToken } from "vscode";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { PerformanceMonitorService } from "@/infrastructure/services";
import { ContextIntelligenceService } from "@/application/services/context/ContextIntelligenceService";
import { ProviderError, ErrorCodes } from "@/errors";
import type { LoadingStep } from "@/constants/Events";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";
import type { ProjectContext } from "@/domain/entities/Selection";

export class ContextEnhancementService {
  private logger: Logger;

  constructor(
    private contextIntelligenceService?: ContextIntelligenceService,
    private performanceMonitor?: PerformanceMonitorService,
    loggingService?: LoggingService,
  ) {
    this.logger = loggingService
      ? createLogger("ContextEnhancementService")
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
  }

  async enhanceContext(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    intelligentContextEnabled: boolean,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<ProjectContext> {
    if (!intelligentContextEnabled || !request.filePath) {
      this.logger.info("Using standard project context (intelligent context disabled)", {
        intelligentContextEnabled,
        hasFilePath: !!request.filePath,
      });
      return projectContext;
    }

    this.logger.info("Intelligent context enabled, starting optimal context selection", {
      filePath: request.filePath,
      providerId: request.providerId,
      model: request.model,
    });

    const contextTimer = this.performanceMonitor?.startTimer("selectOptimalContext", {
      filePath: request.filePath,
      providerId: request.providerId,
      model: request.model,
    });

    try {
      if (cancellationToken?.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }
      const selectStart = Date.now();
      const optimalContext = await this.contextIntelligenceService!.selectOptimalContext(
        request.filePath,
        request.providerId || "",
        request.model,
        onProgress,
        request.snippet,
      );

      if (cancellationToken?.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }
      const selectDuration = Date.now() - selectStart;
      this.logger.info("selectOptimalContext completed successfully", {
        duration: selectDuration,
        durationSeconds: Math.round(selectDuration / 1000),
        selectedFiles: optimalContext.selectedFiles.length,
        essentialFiles: optimalContext.essentialFiles.length,
        totalTokenCost: optimalContext.totalTokenCost,
        utilizationRate: Math.round(optimalContext.utilizationRate * 100),
        excludedFiles: optimalContext.excludedFiles.length,
      });

      const enhancedContext: ProjectContext = {
        rootName: projectContext.rootName,
        overview: projectContext.overview,
        filesSample: [
          ...optimalContext.essentialFiles.map((f) => f.filePath),
          ...optimalContext.selectedFiles.slice(0, 10).map((f) => f.filePath),
        ],
        related: optimalContext.selectedFiles.slice(0, 20).map((f) => ({
          path: f.filePath,
          reason: f.relevanceType,
          preview: undefined,
        })),
      };

      if (contextTimer) {
        contextTimer();
      }

      this.logger.info("Enhanced context built using intelligent selection", {
        selectedFiles: optimalContext.selectedFiles.length,
        essentialFiles: optimalContext.essentialFiles.length,
        tokenCost: optimalContext.totalTokenCost,
        enhancedFilesSampleCount: enhancedContext.filesSample.length,
        enhancedRelatedCount: enhancedContext.related.length,
        utilizationRate: optimalContext.utilizationRate,
      });

      return enhancedContext;
    } catch (error: unknown) {
      if (contextTimer) {
        contextTimer();
      }
      const errObj = error as Record<string, unknown> | null;
      this.logger.warn("Failed to use intelligent context, falling back to standard context", {
        error: errObj?.message,
        errorCode: errObj?.code,
        stack: errObj?.stack,
        filePath: request.filePath,
      });
      return projectContext;
    }
  }
}
