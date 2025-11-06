import { CancellationToken, workspace, Uri, Position } from "vscode";
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
import { LanguageServerIntegrationService } from "../../infrastructure/services/LanguageServerIntegrationService";
import { DocumentationQualityService } from "./DocumentationQualityService";
import { DocumentationImprovementService } from "./DocumentationImprovementService";
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
  private qualityService: DocumentationQualityService;
  private improvementService: DocumentationImprovementService;

  constructor(
    private llmRegistry: LLMRegistry,
    private generationCacheService: GenerationCacheService,
    private contextIntelligenceService?: ContextIntelligenceService,
    private performanceMonitor?: PerformanceMonitorService,
    private loggingService?: LoggingService,
    private intelligentContextEnabled = false,
    private languageServerIntegrationService?: LanguageServerIntegrationService,
  ) {
    this.logger = loggingService
      ? createLogger("WikiGenerationFlow", loggingService)
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
    this.qualityService = new DocumentationQualityService(
      loggingService ||
        new LoggingService({
          enabled: false,
          level: "error",
          includeTimestamp: true,
          includeService: true,
        }),
    );
    this.improvementService = new DocumentationImprovementService(
      loggingService ||
        new LoggingService({
          enabled: false,
          level: "error",
          includeTimestamp: true,
          includeService: true,
        }),
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
      enhancedContext = await this.enhanceContext(
        request,
        projectContext,
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

    emitStep(LoadingSteps.collectingSemanticInfo);
    const semanticInfo = await this.collectSemanticInfo(request, cancellationToken);
    completeStep(LoadingSteps.collectingSemanticInfo);

    const rawResult = await this.callLLM(
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
    semanticInfo: any,
    onProgress?: (step: LoadingStep) => void,
    cancellationToken?: CancellationToken,
  ): Promise<{ content: string }> {
    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    this.logger.info("Sending request to LLM", {
      providerId: request.providerId,
      model: request.model,
      hasSemanticInfo: !!semanticInfo,
    });
    const sendStepStart = Date.now();
    onProgress?.(LoadingSteps.sendingLLMRequest);

    if (cancellationToken?.isCancellationRequested) {
      throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
    }

    const llmRequestStart = Date.now();
    const generationPromise = this.llmRegistry.generate(request.providerId as ProviderId, {
      model: request.model,
      snippet: generationInput.snippet,
      languageId: request.languageId,
      filePath: request.filePath,
      semanticInfo,
      project: generationInput.project,
    });
    const sendStepDuration = Date.now() - sendStepStart;
    this.logger.debug("Sending LLM request step completed", {
      step: LoadingSteps.sendingLLMRequest,
      duration: sendStepDuration,
    });

    this.logger.info("Waiting for LLM response");
    const waitStepStart = Date.now();
    onProgress?.(LoadingSteps.waitingForLLMResponse);
    try {
      const rawResult = await generationPromise;
      const waitStepDuration = Date.now() - waitStepStart;
      this.logger.debug("Waiting for LLM response step completed", {
        step: LoadingSteps.waitingForLLMResponse,
        duration: waitStepDuration,
      });

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

  private async collectSemanticInfo(
    request: WikiGenerationRequest,
    cancellationToken?: CancellationToken,
  ): Promise<any | null> {
    if (!this.languageServerIntegrationService || !request.filePath) {
      return null;
    }

    if (cancellationToken?.isCancellationRequested) {
      return null;
    }

    try {
      const document = await workspace.openTextDocument(Uri.file(request.filePath));
      const selection = this.getSelectionFromSnippet(document, request.snippet);

      if (!selection) {
        this.logger.debug("Could not determine selection position for semantic info");
        return null;
      }

      const semanticInfo = await this.languageServerIntegrationService.getSemanticInfoForSelection(
        document,
        request.snippet,
        selection,
        cancellationToken,
      );

      if (semanticInfo) {
        this.logger.debug("Collected semantic info", {
          symbolName: semanticInfo.symbolName,
          symbolKind: semanticInfo.symbolKind,
          hasType: !!semanticInfo.type,
          hasReturnType: !!semanticInfo.returnType,
        });
      }

      return semanticInfo;
    } catch (error: any) {
      this.logger.debug("Failed to collect semantic info", {
        error: error?.message,
        filePath: request.filePath,
      });
      return null;
    }
  }

  private getSelectionFromSnippet(document: any, snippet: string): Position | null {
    try {
      const documentText = document.getText();
      const snippetStart = documentText.indexOf(snippet);

      if (snippetStart === -1) {
        const firstLine = snippet.split("\n")[0];
        const firstLineIndex = documentText.indexOf(firstLine);
        if (firstLineIndex === -1) {
          return new Position(0, 0);
        }
        const textBefore = documentText.substring(0, firstLineIndex);
        const lineNumber = textBefore.split("\n").length - 1;
        return new Position(lineNumber, 0);
      }

      const textBefore = documentText.substring(0, snippetStart);
      const lineNumber = textBefore.split("\n").length - 1;
      const columnNumber = textBefore.split("\n").pop()?.length || 0;

      return new Position(lineNumber, columnNumber);
    } catch (error) {
      return null;
    }
  }
}
