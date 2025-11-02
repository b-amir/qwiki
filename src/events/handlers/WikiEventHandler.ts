import type { EventBus } from "../EventBus";
import type { WikiGenerationRequest } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import { InboundEvents, OutboundEvents, LoadingSteps } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import {
  ErrorLoggingService,
  ErrorRecoveryService,
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services";
import { ProviderError, ErrorCodes, getErrorMessage } from "../../errors";

export class WikiEventHandler {
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private wikiService: any,
    private projectContextService: any,
    private errorRecoveryService: ErrorRecoveryService,
    private errorLoggingService: ErrorLoggingService,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("WikiEventHandler", loggingService);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  register(): void {
    this.logger.debug("WikiEventHandler.register started");
    this.eventBus.subscribe(InboundEvents.generateWiki, this.handleGenerateWiki.bind(this));
    this.logger.debug("WikiEventHandler registered for generateWiki event");
    this.eventBus.subscribe(InboundEvents.getRelated, this.handleGetRelated.bind(this));
    this.logger.debug("WikiEventHandler registered for getRelated event");
    this.logger.debug("WikiEventHandler.register completed");
  }

  private async handleGenerateWiki(payload: WikiGenerationRequest): Promise<void> {
    const startTime = Date.now();
    this.logger.debug("handleGenerateWiki started", {
      providerId: payload.providerId,
      snippetLength: payload.snippet?.length,
      filePath: payload.filePath,
      languageId: payload.languageId,
    });

    try {
      const buildContextStart = Date.now();
      this.logger.info("Starting project context build", {
        filePath: payload.filePath,
        snippetLength: payload?.snippet?.length || 0,
        languageId: payload?.languageId,
      });
      this.eventBus.publish(OutboundEvents.loadingStep, { step: LoadingSteps.buildingContext });

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

      const generateWikiStart = Date.now();
      this.logger.info("Starting wiki generation", {
        providerId: payload.providerId,
        model: payload.model,
        snippetLength: payload?.snippet?.length || 0,
      });
      const result = await this.wikiService.generateWiki(
        payload,
        projectContext,
        (step: LoadingStep) => {
          this.logger.debug("Loading step progress", { step });
          this.eventBus.publish(OutboundEvents.loadingStep, { step });
        },
      );
      const generationDuration = Date.now() - generateWikiStart;
      this.logger.info("Wiki generation completed", {
        duration: generationDuration,
        durationSeconds: Math.round(generationDuration / 1000),
        success: result?.success,
        contentLength: result?.content?.length || 0,
        hasError: !!result?.error,
        errorMessage: result?.error || undefined,
        hasResult: !!result,
      });

      if (result && result.success) {
        this.logger.debug("Publishing successful wiki result");
        this.eventBus.publish(OutboundEvents.wikiResult, {
          content: result.content,
          success: true,
        });
      } else {
        const errorMessage = (result && result.error) || "Wiki generation failed";
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

        const error = new ProviderError(
          ErrorCodes.GENERATION_FAILED,
          errorMessage,
          payload.providerId,
        );

        this.logError("Wiki generation failed in handler", {
          code: error.code,
          message: error.message,
          providerId: payload.providerId,
          snippet:
            payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
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
            snippet:
              payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
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
      this.logger.debug("handleGenerateWiki completed successfully", {
        totalDuration: Date.now() - startTime,
      });
    } catch (error: any) {
      const errorDuration = Date.now() - startTime;
      this.logger.error("handleGenerateWiki FAILED with exception", {
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

      this.logError("Exception in handleGenerateWiki", {
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
          snippet:
            payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
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

  private async handleGetRelated(_payload: { filePath: string }): Promise<void> {
    try {
      const projectContext = await this.projectContextService.buildContext("");

      this.eventBus.publish(OutboundEvents.related, {
        rootName: projectContext.rootName,
        overview: projectContext.overview,
        filesSample: projectContext.filesSample,
        related: projectContext.related,
      });
    } catch (error: any) {
      const providerError = ProviderError.fromError(error);

      this.logError("Exception in handleGetRelated", {
        code: providerError.code,
        message: providerError.message,
        filePath: _payload?.filePath,
        originalError: error,
      });

      this.errorLoggingService.logError(providerError);
      const suggestion = this.errorRecoveryService.getActionableSuggestion(providerError);
      this.eventBus.publish(OutboundEvents.error, {
        code: providerError.code,
        message: this.errorRecoveryService.getUserFriendlyMessage(providerError),
        suggestion: suggestion,
        suggestions: suggestion ? [suggestion] : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
