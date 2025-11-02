import { CancellationToken } from "vscode";
import type { LLMRegistry } from "../../llm";
import type { WikiGenerationRequest, WikiGenerationResult } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import type { LoadingStep } from "../../constants/Events";
import { LoadingSteps } from "../../constants/Events";
import { ServiceLimits } from "../../constants";
import type { ProviderId } from "../../llm/types";
import { WikiTransformer, type GenerationInput } from "../transformers/WikiTransformer";
import { ContextIntelligenceService } from "./ContextIntelligenceService";
import { PerformanceMonitorService } from "../../infrastructure/services/PerformanceMonitorService";
import { GenerationCacheService } from "../../infrastructure/services/GenerationCacheService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { ProviderError, ErrorCodes } from "../../errors";

interface GenerateParams {
  snippet: string;
  languageId?: string;
  filePath?: string;
  model?: string;
  project: ProjectContext;
}

export class WikiGenerationFlow {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private generationCacheService: GenerationCacheService,
    private contextIntelligenceService?: ContextIntelligenceService,
    private performanceMonitor?: PerformanceMonitorService,
    private loggingService?: LoggingService,
    private intelligentContextEnabled = false,
  ) {
    this.logger = loggingService
      ? createLogger("WikiGenerationFlow", loggingService)
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
  }

  async execute(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    generateParams: GenerateParams,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<WikiGenerationResult> {
    let enhancedContext = projectContext;
    const startTime = Date.now();
    this.logger.debug("executeGenerationFlow started", {
      filePath: request.filePath,
      providerId: request.providerId,
      intelligentContextEnabled: this.intelligentContextEnabled,
    });

    try {
      enhancedContext = await this.enhanceContext(
        request,
        projectContext,
        onProgress,
        cancellationToken,
      );
    } catch (error: any) {
      if (error?.code === ErrorCodes.GENERATION_CANCELLED) {
        throw error;
      }
      this.logger.error("Context intelligence failed with exception, using fallback", {
        error: error?.message,
        errorCode: error?.code,
        stack: error?.stack,
        filePath: request.filePath,
      });
      enhancedContext = projectContext;
    }

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const analysis = WikiTransformer.analyzeSnippet(request.snippet, request.languageId);
    onProgress?.(LoadingSteps.analyzing);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const contextSummary = WikiTransformer.summarizeContext(enhancedContext);
    onProgress?.(LoadingSteps.finding);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const generationInput = WikiTransformer.prepareGenerationInput(
      request,
      enhancedContext,
      analysis,
      contextSummary,
    );
    onProgress?.(LoadingSteps.preparing);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const promptSeed = WikiTransformer.buildPromptSeed(generationInput);
    onProgress?.(LoadingSteps.buildingPrompt);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const rawResult = await this.callLLM(request, generationInput, onProgress, cancellationToken);

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const processed = WikiTransformer.processGenerationResult(
      rawResult.content,
      generationInput.metadata,
      promptSeed,
    );
    onProgress?.(LoadingSteps.processing);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const finalContent = WikiTransformer.finalizeContent(processed, generationInput.metadata);
    onProgress?.(LoadingSteps.finalizing);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

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

    await this.generationCacheService.cacheGeneration(generateParams, finalResult);

    return finalResult;
  }

  private async enhanceContext(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<ProjectContext> {
    if (!this.intelligentContextEnabled || !request.filePath) {
      this.logger.info("Using standard project context (intelligent context disabled)", {
        intelligentContextEnabled: this.intelligentContextEnabled,
        hasFilePath: !!request.filePath,
      });
      return projectContext;
    }

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
      if (cancellationToken?.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }
      const selectStart = Date.now();
      const optimalContext = await this.contextIntelligenceService!.selectOptimalContext(
        request.filePath,
        request.providerId || "",
        request.model,
        onProgress,
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
      return projectContext;
    }
  }

  private async callLLM(
    request: WikiGenerationRequest,
    generationInput: GenerationInput,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<{ content: string }> {
    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    this.logger.info("Sending request to LLM", {
      providerId: request.providerId,
      model: request.model,
    });
    onProgress?.(LoadingSteps.sendingRequest);

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

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
    try {
      const rawResult = await generationPromise;

      if (cancellationToken?.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }
      const llmResponseDuration = Date.now() - llmRequestStart;
      this.logger.info("LLM response received successfully", {
        duration: llmResponseDuration,
        durationSeconds: Math.round(llmResponseDuration / 1000),
        responseLength: rawResult.content?.length || 0,
        providerId: request.providerId,
        model: request.model,
      });
      return rawResult;
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
  }

  private async yieldForUi(minDuration = ServiceLimits.uiYieldDuration) {
    await new Promise((resolve) => setTimeout(resolve, minDuration));
  }
}
