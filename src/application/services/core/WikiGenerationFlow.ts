import { CancellationToken } from "vscode";
import type { LLMRegistry } from "@/llm";
import type { WikiGenerationRequest, WikiGenerationResult } from "@/domain/entities/Wiki";
import type { ProjectContext } from "@/domain/entities/Selection";
import type { LoadingStep } from "@/constants/Events";
import { LoadingSteps } from "@/constants/Events";
import { ServiceLimits } from "@/constants";
import { WikiTransformer, type GenerationInput } from "@/application/transformers/WikiTransformer";
import { PerformanceMonitorService, GenerationCacheService } from "@/infrastructure/services";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { ProviderError, ErrorCodes } from "@/errors";
import { DocumentationQualityService } from "@/application/services/documentation/DocumentationQualityService";
import { DocumentationImprovementService } from "@/application/services/documentation/DocumentationImprovementService";
import { ContextEnhancementService } from "@/application/services/core/generation/ContextEnhancementService";
import { LLMGenerationService } from "@/application/services/core/generation/LLMGenerationService";
import { SemanticInfoCollector } from "@/application/services/core/generation/SemanticInfoCollector";
import { PromptQualityService } from "@/application/services/prompts/PromptQualityService";

interface GenerateParams {
  snippet: string;
  languageId?: string;
  filePath?: string;
  model?: string;
  project: ProjectContext;
}

export class WikiGenerationFlow {
  private logger: Logger;
  private qualityService: DocumentationQualityService;
  private improvementService: DocumentationImprovementService;
  private contextEnhancementService: ContextEnhancementService;
  private llmGenerationService: LLMGenerationService;
  private semanticInfoCollector: SemanticInfoCollector;

  constructor(
    private llmRegistry: LLMRegistry,
    private generationCacheService: GenerationCacheService,
    private contextIntelligenceService?: any,
    private performanceMonitor?: PerformanceMonitorService,
    private loggingService?: LoggingService,
    private intelligentContextEnabled = false,
    private languageServerIntegrationService?: any,
    private promptQualityService?: PromptQualityService,
  ) {
    this.logger = loggingService
      ? createLogger("WikiGenerationFlow")
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
    this.qualityService = new DocumentationQualityService(loggingService || new LoggingService());
    this.improvementService = new DocumentationImprovementService(
      loggingService || new LoggingService(),
    );
    this.contextEnhancementService = new ContextEnhancementService(
      contextIntelligenceService,
      performanceMonitor,
      loggingService,
    );
    this.llmGenerationService = new LLMGenerationService(llmRegistry, loggingService);
    this.semanticInfoCollector = new SemanticInfoCollector(
      languageServerIntegrationService,
      loggingService,
    );
  }

  async execute(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    generateParams: GenerateParams,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<WikiGenerationResult> {
    const stepStartTimes = new Map<LoadingStep, number>();
    const emitStep = (step: LoadingStep) => {
      const timestamp = Date.now();
      stepStartTimes.set(step, timestamp);
      this.logger.debug("Loading step emitted", { step, timestamp });
      onProgress?.(step);
    };
    const completeStep = (step: LoadingStep) => {
      const startTime = stepStartTimes.get(step);
      if (startTime) {
        const duration = Date.now() - startTime;
        this.logger.debug("Loading step completed", { step, duration, durationMs: duration });
        stepStartTimes.delete(step);
      }
    };

    emitStep(LoadingSteps.validatingProvider);
    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    let enhancedContext = projectContext;
    const startTime = Date.now();
    this.logger.debug("executeGenerationFlow started", {
      filePath: request.filePath,
      providerId: request.providerId,
      intelligentContextEnabled: this.intelligentContextEnabled,
    });

    emitStep(LoadingSteps.initializingContext);
    try {
      enhancedContext = await this.contextEnhancementService.enhanceContext(
        request,
        projectContext,
        this.intelligentContextEnabled,
        onProgress,
        cancellationToken,
      );
      completeStep(LoadingSteps.initializingContext);
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
      completeStep(LoadingSteps.initializingContext);
    }

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    emitStep(LoadingSteps.analyzingSnippet);
    const analysis = WikiTransformer.analyzeSnippet(request.snippet, request.languageId);
    completeStep(LoadingSteps.analyzingSnippet);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    emitStep(LoadingSteps.buildingContextSummary);
    const contextSummary = WikiTransformer.summarizeContext(enhancedContext);
    completeStep(LoadingSteps.buildingContextSummary);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    emitStep(LoadingSteps.preparingGenerationInput);
    const generationInput = WikiTransformer.prepareGenerationInput(
      request,
      enhancedContext,
      analysis,
      contextSummary,
    );
    completeStep(LoadingSteps.preparingGenerationInput);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    emitStep(LoadingSteps.buildingPrompt);
    const promptSeed = WikiTransformer.buildPromptSeed(generationInput);
    completeStep(LoadingSteps.buildingPrompt);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    if (this.promptQualityService) {
      emitStep(LoadingSteps.validatingPromptQuality);
      try {
        const qualityResult = await this.promptQualityService.runQualityAssurance(
          promptSeed,
          projectContext,
        );
        this.logger.debug("Prompt quality validated", {
          passed: qualityResult.passed,
          overallScore: qualityResult.report.overallScore,
          suggestionCount: qualityResult.suggestions.length,
        });

        if (!qualityResult.passed) {
          this.logger.warn("Prompt quality below threshold", {
            score: qualityResult.report.overallScore,
            suggestions: qualityResult.suggestions.map((s) => s.description),
          });
        }
      } catch (error) {
        this.logger.warn("Prompt quality validation failed, continuing", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      completeStep(LoadingSteps.validatingPromptQuality);
      await this.yieldForUi();

      if (cancellationToken?.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }
    }

    emitStep(LoadingSteps.collectingSemanticInfo);
    const semanticInfo = await this.semanticInfoCollector.collectSemanticInfo(
      request,
      cancellationToken,
    );
    completeStep(LoadingSteps.collectingSemanticInfo);

    const rawResult = await this.llmGenerationService.callLLM(
      request,
      generationInput,
      semanticInfo,
      onProgress,
      cancellationToken,
    );

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    emitStep(LoadingSteps.processingLLMOutput);
    const processed = WikiTransformer.processGenerationResult(
      rawResult.content,
      generationInput.metadata,
      promptSeed,
    );
    completeStep(LoadingSteps.processingLLMOutput);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    emitStep(LoadingSteps.finalizingDocumentation);
    const finalContent = WikiTransformer.finalizeContent(processed, generationInput.metadata);
    completeStep(LoadingSteps.finalizingDocumentation);
    await this.yieldForUi();

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const qualityMetrics = this.qualityService.calculateQualityMetrics(
      finalContent,
      request.snippet,
    );
    const improvementAnalysis = this.improvementService.generateImprovements(
      finalContent,
      request.snippet,
      qualityMetrics,
    );

    this.logger.debug("Documentation quality analysis completed", {
      overallScore: qualityMetrics.overallScore,
      suggestionCount: improvementAnalysis.suggestions.length,
      canImprove: improvementAnalysis.canImprove,
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

    await this.generationCacheService.cacheGeneration(generateParams, finalResult);

    return finalResult;
  }

  private async yieldForUi(minDuration = ServiceLimits.uiYieldDuration) {
    await new Promise((resolve) => setTimeout(resolve, minDuration));
  }
}
