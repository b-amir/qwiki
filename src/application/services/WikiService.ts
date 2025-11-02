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
    const startTime = Date.now();
    this.logger.debug("generateWiki started", {
      providerId: request.providerId,
      snippetLength: request.snippet?.length,
      filePath: request.filePath,
    });

    try {
      this.logger.debug("Setting loading step to validating");
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

      const cacheCheckStart = Date.now();
      this.logger.debug("Checking generation cache");
      const cachedResult = await this.generationCacheService.getCachedGeneration(generateParams);
      this.logger.debug("Cache check completed", {
        duration: Date.now() - cacheCheckStart,
        cached: !!cachedResult,
      });

      if (cachedResult) {
        this.logger.debug("Using cached result");
        onProgress?.(LoadingSteps.processing);
        onProgress?.(LoadingSteps.finalizing);
        return {
          content: cachedResult.content,
          success: true,
        };
      }

      if (request.snippet.length > ServiceLimits.largeSnippetThreshold) {
        this.logger.debug("Using large generation path");
        return this.backgroundProcessingService.enqueueTask(
          `generate-wiki-${Date.now()}`,
          () => this.performLargeGeneration(request, projectContext, generateParams, onProgress),
          TaskPriority.HIGH,
        ) as any;
      }

      this.logger.debug("Calling performGeneration");
      const result = await this.performGeneration(
        request,
        projectContext,
        generateParams,
        onProgress,
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
          return this.executeGenerationFlow(request, projectContext, generateParams, onProgress);
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
    this.logger.debug("executeGenerationFlow started", {
      filePath: request.filePath,
      providerId: request.providerId,
      intelligentContextEnabled: this.intelligentContextEnabled,
    });

    try {
      if (this.intelligentContextEnabled && request.filePath) {
        this.logger.info("Intelligent context enabled, starting optimal context selection", {
          filePath: request.filePath,
          providerId: request.providerId,
          model: request.model,
        });
        onProgress?.(LoadingSteps.selectingContext);

        const contextTimer = this.performanceMonitor?.startTimer("selectOptimalContext", {
          filePath: request.filePath,
          providerId: request.providerId,
          model: request.model,
        });

        try {
          const selectStart = Date.now();
          this.logger.info("Calling contextIntelligenceService.selectOptimalContext", {
            filePath: request.filePath,
            providerId: request.providerId,
            model: request.model,
          });
          const optimalContext = await this.contextIntelligenceService!.selectOptimalContext(
            request.filePath,
            request.providerId || "",
            request.model,
            onProgress,
          );
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

          this.logger.info("Building enhanced context from optimal selection");
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

          this.logger.info("Enhanced context built using intelligent selection", {
            selectedFiles: optimalContext.selectedFiles.length,
            essentialFiles: optimalContext.essentialFiles.length,
            tokenCost: optimalContext.totalTokenCost,
            enhancedFilesSampleCount: enhancedContext.filesSample.length,
            enhancedRelatedCount: enhancedContext.related.length,
            utilizationRate: optimalContext.utilizationRate,
          });
        } catch (error: any) {
          if (contextTimer) {
            contextTimer();
          }
          this.logger.warn("Failed to use intelligent context, falling back to standard context", {
            error: error?.message,
            errorCode: error?.code,
            stack: error?.stack,
            filePath: request.filePath,
          });
          enhancedContext = projectContext;
        }
      } else {
        this.logger.info("Using standard project context (intelligent context disabled)", {
          intelligentContextEnabled: this.intelligentContextEnabled,
          hasFilePath: !!request.filePath,
          reason: !this.intelligentContextEnabled
            ? "Context intelligence service not available"
            : !request.filePath
              ? "No file path provided"
              : "Unknown",
        });
      }
    } catch (error: any) {
      this.logger.error("Context intelligence failed with exception, using fallback", {
        error: error?.message,
        errorCode: error?.code,
        stack: error?.stack,
        filePath: request.filePath,
      });
      enhancedContext = projectContext;
    }

    this.logger.debug("Starting code snippet analysis");
    const analysis = WikiTransformer.analyzeSnippet(request.snippet, request.languageId);
    onProgress?.(LoadingSteps.analyzing);
    await this.yieldForUi();
    this.logger.debug("Code snippet analysis completed", {
      languageId: analysis.languageId,
      lineCount: analysis.lineCount,
      characterCount: analysis.characterCount,
      symbolsCount: analysis.symbols.length,
    });

    this.logger.debug("Summarizing enhanced context");
    const contextSummary = WikiTransformer.summarizeContext(enhancedContext);
    onProgress?.(LoadingSteps.finding);
    await this.yieldForUi();
    this.logger.debug("Context summary completed", {
      relatedCount: contextSummary.relatedCount,
      filesSampleCount: contextSummary.filesSample.length,
      hasOverview: contextSummary.hasOverview,
      hasRootName: contextSummary.hasRootName,
    });

    this.logger.debug("Preparing generation input");
    const generationInput = WikiTransformer.prepareGenerationInput(
      request,
      enhancedContext,
      analysis,
      contextSummary,
    );
    onProgress?.(LoadingSteps.preparing);
    await this.yieldForUi();
    this.logger.debug("Generation input prepared", {
      inputSize: JSON.stringify(generationInput).length,
    });

    this.logger.info("Building documentation prompt");
    const promptSeed = WikiTransformer.buildPromptSeed(generationInput);
    onProgress?.(LoadingSteps.buildingPrompt);
    await this.yieldForUi();
    this.logger.debug("Prompt built", {
      promptSeedLength: promptSeed.length,
    });

    this.logger.info("Sending request to LLM", {
      providerId: request.providerId,
      model: request.model,
    });
    onProgress?.(LoadingSteps.sendingRequest);
    const llmRequestStart = Date.now();
    const generationPromise = this.llmRegistry.generate(request.providerId as ProviderId, {
      model: request.model,
      snippet: generationInput.snippet,
      languageId: request.languageId,
      filePath: request.filePath,
      project: generationInput.project,
    });

    this.logger.info("Waiting for LLM response");
    onProgress?.(LoadingSteps.waitingForResponse);
    let rawResult;
    try {
      rawResult = await generationPromise;
      const llmResponseDuration = Date.now() - llmRequestStart;
      this.logger.info("LLM response received successfully", {
        duration: llmResponseDuration,
        durationSeconds: Math.round(llmResponseDuration / 1000),
        responseLength: rawResult.content?.length || 0,
        providerId: request.providerId,
        model: request.model,
      });
    } catch (llmError: any) {
      const llmErrorDuration = Date.now() - llmRequestStart;
      this.logger.error("LLM generation FAILED", {
        duration: llmErrorDuration,
        durationSeconds: Math.round(llmErrorDuration / 1000),
        error: llmError?.message,
        errorCode: llmError?.code,
        errorName: llmError?.name,
        stack: llmError?.stack,
        providerId: request.providerId,
        model: request.model,
      });
      throw llmError;
    }

    this.logger.debug("Processing LLM response");
    const processed = WikiTransformer.processGenerationResult(
      rawResult.content,
      generationInput.metadata,
      promptSeed,
    );
    onProgress?.(LoadingSteps.processing);
    await this.yieldForUi();
    this.logger.debug("Response processed", {
      processedContentLength: processed.content.length,
      headingCount: processed.metrics.headingCount,
      paragraphCount: processed.metrics.paragraphCount,
      listCount: processed.metrics.listCount,
    });

    this.logger.debug("Finalizing wiki content");
    const finalContent = WikiTransformer.finalizeContent(processed, generationInput.metadata);
    onProgress?.(LoadingSteps.finalizing);
    await this.yieldForUi();
    this.logger.debug("Content finalized", {
      finalLength: finalContent.length,
    });

    const finalResult: WikiGenerationResult = {
      content: finalContent,
      success: true,
    };

    const generationTime = Date.now() - startTime;
    this.logger.info("Wiki generation flow completed successfully", {
      totalDuration: generationTime,
      totalDurationSeconds: Math.round(generationTime / 1000),
      providerId: request.providerId,
      model: request.model,
      intelligentContext: this.intelligentContextEnabled,
      finalContentLength: finalContent.length,
    });

    if (this.performanceMonitor) {
      this.performanceMonitor.startTimer("generateWiki", {
        providerId: request.providerId,
        model: request.model,
        intelligentContext: this.intelligentContextEnabled,
      })();
    }

    this.logger.debug("Caching generation result");
    await this.generationCacheService.cacheGeneration(generateParams, finalResult);
    this.logger.debug("Generation result cached");

    return finalResult;
  }

  private async yieldForUi(minDuration = ServiceLimits.uiYieldDuration) {
    await new Promise((resolve) => setTimeout(resolve, minDuration));
  }
}
