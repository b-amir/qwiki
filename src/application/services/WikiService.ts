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
import {
  WikiTransformer,
  type SnippetAnalysis,
  type ContextSummary,
  type GenerationInput,
  type GenerationMetadata,
  type ProcessedGeneration,
} from "../transformers/WikiTransformer";
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

export class WikiService {
  private debouncedGenerate: any;
  private generationCacheKeyPrefix = "wiki_generation";
  private logger: Logger;
  private intelligentContextEnabled = false;

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
  }

  async generateWiki(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    onProgress?: (step: LoadingStep) => void,
  ): Promise<WikiGenerationResult> {
    try {
      onProgress?.(LoadingSteps.validating);

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

      const cachedResult = await this.generationCacheService.getCachedGeneration(generateParams);
      if (cachedResult) {
        onProgress?.(LoadingSteps.processing);
        onProgress?.(LoadingSteps.finalizing);
        return {
          content: cachedResult.content,
          success: true,
        };
      }

      if (request.snippet.length > ServiceLimits.largeSnippetThreshold) {
        return this.backgroundProcessingService.enqueueTask(
          `generate-wiki-${Date.now()}`,
          () => this.performLargeGeneration(request, projectContext, generateParams, onProgress),
          TaskPriority.HIGH,
        ) as any;
      }

      return this.performGeneration(request, projectContext, generateParams, onProgress);
    } catch (error: any) {
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
  ): Promise<WikiGenerationResult> {
    return this.requestBatchingService.batchRequest(
      async () => {
        return this.executeGenerationFlow(request, projectContext, generateParams, onProgress);
      },
      {
        maxBatchSize: ServiceLimits.batchMaxSize,
        maxWaitTime: ServiceLimits.batchMaxWaitTime,
        deduplicationKey: `${this.generationCacheKeyPrefix}_${request.snippet.substring(0, ServiceLimits.deduplicationKeyPrefixLength)}`,
      },
    );
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
  ): Promise<WikiGenerationResult> {
    await this.memoryOptimizationService.optimizeMemory();
    const result = await this.executeGenerationFlow(
      request,
      projectContext,
      generateParams,
      onProgress,
    );
    await this.memoryOptimizationService.optimizeMemory();
    return result;
  }

  private async executeGenerationFlow(
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
  ): Promise<WikiGenerationResult> {
    let enhancedContext = projectContext;
    const startTime = Date.now();

    try {
      if (this.intelligentContextEnabled && request.filePath) {
        const contextTimer = this.performanceMonitor?.startTimer("selectOptimalContext", {
          filePath: request.filePath,
          providerId: request.providerId,
          model: request.model,
        });

        try {
          const optimalContext = await this.contextIntelligenceService!.selectOptimalContext(
            request.filePath,
            request.providerId || "",
            request.model,
          );

          enhancedContext = {
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

          this.logger.debug("Enhanced context using intelligent selection", {
            selectedFiles: optimalContext.selectedFiles.length,
            essentialFiles: optimalContext.essentialFiles.length,
            tokenCost: optimalContext.totalTokenCost,
          });
        } catch (error) {
          if (contextTimer) {
            contextTimer();
          }
          this.logger.warn(
            "Failed to use intelligent context, falling back to standard context",
            error,
          );
          enhancedContext = projectContext;
        }
      }
    } catch (error) {
      this.logger.warn("Context intelligence failed, using fallback", error);
      enhancedContext = projectContext;
    }

    const analysis = WikiTransformer.analyzeSnippet(request.snippet, request.languageId);
    onProgress?.(LoadingSteps.analyzing);
    await this.yieldForUi();

    const contextSummary = WikiTransformer.summarizeContext(enhancedContext);
    onProgress?.(LoadingSteps.finding);
    await this.yieldForUi();

    const generationInput = WikiTransformer.prepareGenerationInput(
      request,
      enhancedContext,
      analysis,
      contextSummary,
    );
    onProgress?.(LoadingSteps.preparing);
    await this.yieldForUi();

    const promptSeed = WikiTransformer.buildPromptSeed(generationInput);
    onProgress?.(LoadingSteps.buildingPrompt);
    await this.yieldForUi();

    onProgress?.(LoadingSteps.sendingRequest);
    const generationPromise = this.llmRegistry.generate(request.providerId as ProviderId, {
      model: request.model,
      snippet: generationInput.snippet,
      languageId: request.languageId,
      filePath: request.filePath,
      project: generationInput.project,
    });

    onProgress?.(LoadingSteps.waitingForResponse);
    const rawResult = await generationPromise;

    const processed = WikiTransformer.processGenerationResult(
      rawResult.content,
      generationInput.metadata,
      promptSeed,
    );
    onProgress?.(LoadingSteps.processing);
    await this.yieldForUi();

    const finalContent = WikiTransformer.finalizeContent(processed, generationInput.metadata);
    onProgress?.(LoadingSteps.finalizing);
    await this.yieldForUi();

    const finalResult: WikiGenerationResult = {
      content: finalContent,
      success: true,
    };

    const generationTime = Date.now() - startTime;
    if (this.performanceMonitor) {
      this.performanceMonitor.startTimer("generateWiki", {
        providerId: request.providerId,
        model: request.model,
        intelligentContext: this.intelligentContextEnabled,
      })();
    }

    await this.generationCacheService.cacheGeneration(generateParams, finalResult);

    return finalResult;
  }

  private async yieldForUi(minDuration = ServiceLimits.uiYieldDuration) {
    await new Promise((resolve) => setTimeout(resolve, minDuration));
  }
}
