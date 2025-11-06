import { CancellationToken } from "vscode";
import type { LLMRegistry } from "../../llm";
import type { WikiGenerationRequest, WikiGenerationResult } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import { LoadingSteps } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes, ErrorMessages, ServiceLimits } from "../../constants";
import type { ProviderId } from "../../llm/types";
import { WikiError } from "../../errors";
import { GenerationCacheService } from "../../infrastructure/services/GenerationCacheService";
import { RequestBatchingService } from "../../infrastructure/services/RequestBatchingService";
import { DebouncingService } from "../../infrastructure/services/DebouncingService";
import {
  BackgroundProcessingService,
  TaskPriority,
} from "../../infrastructure/services/BackgroundProcessingService";
import { MemoryOptimizationService } from "../../infrastructure/services/MemoryOptimizationService";
import { ContextIntelligenceService } from "./ContextIntelligenceService";
import { ContextCompressionService } from "./ContextCompressionService";
import { AdvancedPromptService } from "./AdvancedPromptService";
import { PerformanceMonitorService } from "../../infrastructure/services/PerformanceMonitorService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { CachedProjectContextService } from "./CachedProjectContextService";
import { WikiGenerationFlow } from "./WikiGenerationFlow";
import { LanguageServerIntegrationService } from "../../infrastructure/services/LanguageServerIntegrationService";

export class WikiService {
  private debouncedGenerate: any;
  private generationCacheKeyPrefix = "wiki_generation";
  private logger: Logger;
  private intelligentContextEnabled = false;
  private generationFlow: WikiGenerationFlow;

  constructor(
    private llmRegistry: LLMRegistry,
    private generationCacheService: GenerationCacheService,
    private requestBatchingService: RequestBatchingService,
    private debouncingService: DebouncingService,
    private backgroundProcessingService: BackgroundProcessingService,
    private memoryOptimizationService: MemoryOptimizationService,
    private contextIntelligenceService?: ContextIntelligenceService,
    private contextCompressionService?: ContextCompressionService,
    private advancedPromptService?: AdvancedPromptService,
    private performanceMonitor?: PerformanceMonitorService,
    private cachedProjectContextService?: CachedProjectContextService,
    private loggingService?: LoggingService,
    private languageServerIntegrationService?: LanguageServerIntegrationService,
  ) {
    this.logger = loggingService
      ? createLogger("WikiService", loggingService)
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
    this.debouncedGenerate = this.debouncingService.debounce(
      this.performGeneration.bind(this),
      ServiceLimits.debounceDelay,
      { leading: false, trailing: true },
    );
    this.intelligentContextEnabled = Boolean(
      contextIntelligenceService && advancedPromptService && cachedProjectContextService,
    );
    this.generationFlow = new WikiGenerationFlow(
      llmRegistry,
      generationCacheService,
      contextIntelligenceService,
      performanceMonitor,
      loggingService,
      this.intelligentContextEnabled,
      languageServerIntegrationService,
    );
  }

  async generateWiki(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<WikiGenerationResult> {
    const startTime = Date.now();
    this.logger.debug("generateWiki started", {
      providerId: request.providerId,
      snippetLength: request.snippet?.length,
      filePath: request.filePath,
    });

    try {
      this.logger.debug("Setting loading step to validatingProvider");
      onProgress?.(LoadingSteps.validatingProvider);

      if (cancellationToken?.isCancellationRequested) {
        throw new WikiError("missingSnippet", "Generation cancelled");
      }

      if (!request.snippet?.trim()) {
        throw new WikiError("missingSnippet", ErrorMessages[ErrorCodes.missingSnippet]);
      }

      const generateParams = {
        snippet: request.snippet,
        languageId: request.languageId,
        filePath: request.filePath,
        model: request.model,
        project: projectContext,
      };

      const cacheCheckStart = Date.now();
      this.logger.debug("Checking generation cache");
      const cachedResult = await this.generationCacheService.getCachedGeneration(generateParams);
      this.logger.debug("Cache check completed", {
        duration: Date.now() - cacheCheckStart,
        cached: !!cachedResult,
      });

      if (cachedResult) {
        this.logger.debug("Using cached result");
        onProgress?.(LoadingSteps.processingLLMOutput);
        onProgress?.(LoadingSteps.finalizingDocumentation);
        return {
          content: cachedResult.content,
          success: true,
        };
      }

      if (request.snippet.length > ServiceLimits.largeSnippetThreshold) {
        this.logger.debug("Using large generation path");
        return this.backgroundProcessingService.enqueueTask(
          `generate-wiki-${Date.now()}`,
          () =>
            this.performLargeGeneration(
              request,
              projectContext,
              generateParams,
              onProgress,
              cancellationToken,
            ),
          TaskPriority.HIGH,
        ) as any;
      }

      this.logger.debug("Calling performGeneration");
      const result = await this.performGeneration(
        request,
        projectContext,
        generateParams,
        onProgress,
        cancellationToken,
      );
      this.logger.debug("generateWiki completed", {
        duration: Date.now() - startTime,
        success: result?.success,
      });
      return result;
    } catch (error: any) {
      const errorDuration = Date.now() - startTime;
      this.logger.error("generateWiki FAILED with exception", {
        duration: errorDuration,
        durationSeconds: Math.round(errorDuration / 1000),
        error: error?.message,
        errorCode: error?.code,
        stack: error?.stack,
        providerId: request.providerId,
        snippetLength: request.snippet?.length || 0,
        filePath: request.filePath,
      });
      return {
        content: "",
        success: false,
        error: error?.message || ErrorMessages[ErrorCodes.generationFailed],
      };
    }
  }

  private async performGeneration(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    generateParams: {
      snippet: string;
      languageId?: string;
      filePath?: string;
      model?: string;
      project: ProjectContext;
    },
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<WikiGenerationResult> {
    const startTime = Date.now();
    const deduplicationKey = `${this.generationCacheKeyPrefix}_${request.snippet.substring(0, ServiceLimits.deduplicationKeyPrefixLength)}`;
    this.logger.debug("performGeneration started", {
      deduplicationKey: deduplicationKey.substring(0, 50),
    });

    try {
      const result = await this.requestBatchingService.batchRequest(
        async () => {
          this.logger.debug("Executing generation flow inside batch");
          return this.generationFlow.execute(
            request,
            projectContext,
            generateParams,
            onProgress,
            cancellationToken,
          );
        },
        {
          maxBatchSize: ServiceLimits.batchMaxSize,
          maxWaitTime: ServiceLimits.batchMaxWaitTime,
          deduplicationKey,
        },
      );
      this.logger.debug("performGeneration completed", {
        duration: Date.now() - startTime,
        success: result?.success,
      });
      return result;
    } catch (error: any) {
      this.logger.debug("performGeneration failed", {
        duration: Date.now() - startTime,
        error: error?.message,
      });
      throw error;
    }
  }

  private async performLargeGeneration(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    generateParams: {
      snippet: string;
      languageId?: string;
      filePath?: string;
      model?: string;
      project: ProjectContext;
    },
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<WikiGenerationResult> {
    await this.memoryOptimizationService.optimizeMemory();
    const result = await this.generationFlow.execute(
      request,
      projectContext,
      generateParams,
      onProgress,
      cancellationToken,
    );
    await this.memoryOptimizationService.optimizeMemory();
    return result;
  }
}
