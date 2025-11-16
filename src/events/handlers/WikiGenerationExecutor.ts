import { CancellationToken, workspace } from "vscode";
import type { EventBus } from "@/events/EventBus";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";
import type { ProjectContext } from "@/domain/entities/Selection";
import { OutboundEvents, LoadingSteps } from "@/constants/Events";
import type { LoadingStep } from "@/constants/Events";
import {
  ErrorLoggingService,
  ErrorRecoveryService,
  createLogger,
  type Logger,
  type ProviderValidationService,
} from "@/infrastructure/services";
import { ProviderError, ErrorCodes } from "@/errors";
import { publishValidationError } from "@/events/handlers/ErrorHandlingHelpers";
import { getProgressMessageForStep } from "@/constants/loading";
import { qwikiStatusBarItem } from "@//extension";
import { VSCodeCommandIds } from "@/constants/Commands";
import type { WikiService } from "@/application/services/core/WikiService";
import type { CachedWikiService } from "@/application/services/core/CachedWikiService";
import type { ContextCacheService } from "@/infrastructure/services/caching/ContextCacheService";

export class WikiGenerationExecutor {
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private wikiService: WikiService,
    private cachedWikiService: CachedWikiService,
    private projectContextService: any,
    private errorRecoveryService: ErrorRecoveryService,
    private errorLoggingService: ErrorLoggingService,
    private providerValidationService: ProviderValidationService,
    private loggingService: any,
    private updateStatusBar: (message: string) => void,
    private resetStatusBar: () => void,
    private contextCacheService?: ContextCacheService,
  ) {
    this.logger = createLogger("WikiGenerationExecutor");
  }

  private getWikiService(): WikiService | CachedWikiService {
    const useLongTermCache = workspace
      .getConfiguration("qwiki")
      .get<boolean>("wikiGeneration.useLongTermCache", false);

    if (useLongTermCache) {
      this.logger.debug("Using cachedWikiService for long-term caching");
      return this.cachedWikiService;
    }

    return this.wikiService;
  }

  async execute(
    payload: WikiGenerationRequest,
    cancellationToken: CancellationToken,
  ): Promise<void> {
    const startTime = Date.now();
    this.logger.debug("executeGeneration started", {
      providerId: payload.providerId,
      snippetLength: payload.snippet?.length,
      filePath: payload.filePath,
      languageId: payload.languageId,
    });

    await this.runGenerationSteps(payload, cancellationToken);
  }

  private async runGenerationSteps(
    payload: WikiGenerationRequest,
    cancellationToken: CancellationToken,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const validatingMessage = getProgressMessageForStep(LoadingSteps.validatingProvider);
      this.updateStatusBar(validatingMessage);
      this.eventBus.publish(OutboundEvents.loadingStep, { step: LoadingSteps.validatingProvider });

      if (cancellationToken.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }

      const validationResult = await this.providerValidationService.validateBeforeGeneration(
        payload.providerId,
        payload.model,
      );

      if (!validationResult.isValid) {
        this.logger.error("Validation failed before generation", {
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
        await publishValidationError(validationResult, this.eventBus, this.logger);
        return;
      }

      if (cancellationToken.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }

      const projectContext = await this.buildProjectContext(payload);

      if (cancellationToken.isCancellationRequested) {
        throw new ProviderError(ErrorCodes.GENERATION_CANCELLED, "Generation cancelled by user");
      }

      const result = await this.generateWiki(payload, projectContext, cancellationToken);

      if (cancellationToken.isCancellationRequested) {
        return;
      }

      if (result && result.success) {
        this.logger.debug("Publishing successful wiki result");
        this.eventBus.publish(OutboundEvents.wikiGenerationComplete, {
          content: result.content,
          success: true,
        });
        this.eventBus.publish(OutboundEvents.wikiResult, {
          content: result.content,
          success: true,
        });
      } else {
        await this.handleGenerationFailure(payload, result);
      }
      this.logger.debug("runGenerationSteps completed successfully", {
        totalDuration: Date.now() - startTime,
      });
    } catch (error: any) {
      await this.handleGenerationError(error, payload, Date.now() - startTime);
    }
  }

  private async buildProjectContext(payload: WikiGenerationRequest): Promise<ProjectContext> {
    const buildContextStart = Date.now();
    this.logger.info("Starting project context build", {
      filePath: payload.filePath,
      snippetLength: payload?.snippet?.length || 0,
      languageId: payload?.languageId,
    });
    const buildingContextMessage = getProgressMessageForStep(LoadingSteps.initializingContext);
    this.updateStatusBar(buildingContextMessage);
    this.eventBus.publish(OutboundEvents.loadingStep, { step: LoadingSteps.initializingContext });

    if (this.contextCacheService && payload.filePath) {
      const cacheStart = Date.now();
      const cachedContext = await this.contextCacheService.getFileContext(payload.filePath);
      if (cachedContext) {
        this.logger.info("Using cached file context", {
          filePath: payload.filePath,
          cacheDuration: Date.now() - cacheStart,
          symbols: cachedContext.symbols.length,
          imports: cachedContext.imports.length,
        });
      }
    }

    const projectContext = await this.projectContextService.buildContext(
      payload?.snippet || "",
      payload?.filePath,
      payload?.languageId,
    );

    const contextBuildDuration = Date.now() - buildContextStart;
    this.logger.info("Project context built successfully", {
      duration: contextBuildDuration,
      durationSeconds: Math.round(contextBuildDuration / 1000),
      relatedFiles: projectContext.related.length,
      filesSample: projectContext.filesSample?.length || 0,
      hasOverview: !!projectContext.overview,
      rootName: projectContext.rootName,
    });

    return projectContext;
  }

  private async generateWiki(
    payload: WikiGenerationRequest,
    projectContext: ProjectContext,
    cancellationToken: CancellationToken,
  ): Promise<any> {
    const generateWikiStart = Date.now();
    const service = this.getWikiService();
    this.logger.info("Starting wiki generation", {
      providerId: payload.providerId,
      model: payload.model,
      snippetLength: payload?.snippet?.length || 0,
      useLongTermCache: service === this.cachedWikiService,
    });

    let accumulatedContent = "";

    const result = await service.generateWiki(
      payload,
      projectContext,
      (step: LoadingStep) => {
        if (cancellationToken.isCancellationRequested) {
          return;
        }
        const message = getProgressMessageForStep(step);
        this.updateStatusBar(message);
        this.eventBus.publish(OutboundEvents.loadingStep, { step });
      },
      cancellationToken,
      (chunk: string, accumulated: string) => {
        if (cancellationToken.isCancellationRequested) {
          return;
        }
        accumulatedContent = accumulated;
        this.eventBus.publish(OutboundEvents.wikiContentChunk, {
          chunk,
          accumulatedContent: accumulated,
        });
      },
    );
    const generationDuration = Date.now() - generateWikiStart;
    this.logger.info("Wiki generation completed", {
      duration: generationDuration,
      durationSeconds: Math.round(generationDuration / 1000),
      accumulatedContentLength: accumulatedContent.length,
      success: result?.success,
      contentLength: result?.content?.length || 0,
      hasError: !!result?.error,
      errorMessage: result?.error || undefined,
      hasResult: !!result,
    });
    return result;
  }

  private async handleGenerationFailure(
    payload: WikiGenerationRequest,
    result: any,
  ): Promise<void> {
    const errorMessage = (result && result.error) || "Wiki generation failed";
    const isCancellationError =
      errorMessage.includes("cancelled") || errorMessage.includes("Generation cancelled");

    if (isCancellationError) {
      this.logger.info("Wiki generation cancelled, error already published", {
        providerId: payload.providerId,
        snippetLength: payload.snippet?.length || 0,
        filePath: payload.filePath,
      });
      return;
    }

    this.logger.error("Wiki generation FAILED - publishing error to frontend", {
      errorMessage,
      providerId: payload.providerId,
      snippetLength: payload.snippet?.length || 0,
      filePath: payload.filePath,
      languageId: payload.languageId,
      result: result
        ? {
            success: result.success,
            hasError: !!result.error,
            error: result.error,
            contentLength: result.content?.length || 0,
          }
        : null,
    });

    const error = new ProviderError(ErrorCodes.GENERATION_FAILED, errorMessage, payload.providerId);

    this.logger.error("Wiki generation failed in handler", {
      code: error.code,
      message: error.message,
      providerId: payload.providerId,
      snippet: payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
      filePath: payload.filePath,
      languageId: payload.languageId,
      fullError: errorMessage,
    });

    this.errorLoggingService.logError(error);
    const suggestion = this.errorRecoveryService.getActionableSuggestion(error);
    const errorPayload = {
      code: error.code,
      message: this.errorRecoveryService.getUserFriendlyMessage(error),
      suggestion: suggestion,
      suggestions: suggestion ? [suggestion] : undefined,
      originalError: error.message,
      timestamp: new Date().toISOString(),
      context: {
        providerId: payload.providerId,
        snippet: payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
        filePath: payload.filePath,
        languageId: payload.languageId,
      },
    };
    this.logger.info("Publishing error event to EventBus", {
      code: errorPayload.code,
      message: errorPayload.message,
      hasSuggestion: !!suggestion,
      timestamp: errorPayload.timestamp,
    });
    await this.eventBus.publish(OutboundEvents.error, errorPayload);
    this.logger.debug("Error event published successfully");
  }

  private async handleGenerationError(
    error: any,
    payload: WikiGenerationRequest,
    errorDuration: number,
  ): Promise<void> {
    if (error?.code === ErrorCodes.GENERATION_CANCELLED) {
      this.logger.info("Wiki generation cancelled by user", {
        totalDuration: errorDuration,
      });
      return;
    }

    this.logger.error("runGenerationSteps FAILED with exception", {
      totalDuration: errorDuration,
      totalDurationSeconds: Math.round(errorDuration / 1000),
      error: error?.message,
      errorCode: error?.code,
      errorName: error?.name,
      stack: error?.stack,
      providerId: payload.providerId,
      snippetLength: payload.snippet?.length || 0,
      filePath: payload.filePath,
      languageId: payload.languageId,
    });
    const providerError = ProviderError.fromError(error, payload.providerId);

    this.logger.error("Exception in handleGenerateWiki", {
      code: providerError.code,
      message: providerError.message,
      providerId: payload.providerId,
      snippet: payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
      filePath: payload.filePath,
      languageId: payload.languageId,
      originalError: error,
    });

    this.errorLoggingService.logError(providerError);
    const suggestion = this.errorRecoveryService.getActionableSuggestion(providerError);
    const errorPayload = {
      code: providerError.code,
      message: this.errorRecoveryService.getUserFriendlyMessage(providerError),
      suggestion: suggestion,
      suggestions: suggestion ? [suggestion] : undefined,
      originalError: providerError.message,
      timestamp: new Date().toISOString(),
      context: {
        providerId: payload.providerId,
        snippet: payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
        filePath: payload.filePath,
        languageId: payload.languageId,
      },
    };
    this.logger.info("Publishing exception error event to EventBus", {
      code: errorPayload.code,
      message: errorPayload.message,
      hasSuggestion: !!suggestion,
      timestamp: errorPayload.timestamp,
    });
    await this.eventBus.publish(OutboundEvents.error, errorPayload);
    this.logger.debug("Exception error event published successfully");
  }
}
