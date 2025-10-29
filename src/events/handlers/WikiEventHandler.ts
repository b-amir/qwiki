import type { EventBus } from "../EventBus";
import type { WikiGenerationRequest } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import { InboundEvents, OutboundEvents, LoadingSteps } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorLoggingService, ErrorRecoveryService } from "../../infrastructure/services";
import { ProviderError, ErrorCodes, getErrorMessage } from "../../errors";

export class WikiEventHandler {
  constructor(
    private eventBus: EventBus,
    private wikiService: any,
    private projectContextService: any,
    private errorRecoveryService: ErrorRecoveryService,
    private errorLoggingService: ErrorLoggingService,
  ) {}

  register(): void {
    this.eventBus.subscribe(InboundEvents.generateWiki, this.handleGenerateWiki.bind(this));
    this.eventBus.subscribe(InboundEvents.getRelated, this.handleGetRelated.bind(this));
  }

  private async handleGenerateWiki(payload: WikiGenerationRequest): Promise<void> {
    try {
      const projectContext = await this.projectContextService.buildContext(
        payload?.snippet || "",
        payload?.filePath,
        payload?.languageId,
      );

      await this.wikiService
        .generateWiki(payload, projectContext, (step: LoadingStep) => {
          this.eventBus.publish(OutboundEvents.loadingStep, { step });
        })
        .then((result: any) => {
          if (result.success) {
            this.eventBus.publish(OutboundEvents.wikiResult, {
              content: result.content,
              success: true,
            });
          } else {
            const error = new ProviderError(
              ErrorCodes.GENERATION_FAILED,
              result.error || "Wiki generation failed",
              payload.providerId,
            );

            console.error("[QWIKI]", `Wiki generation failed in handler`, {
              code: error.code,
              message: error.message,
              providerId: payload.providerId,
              snippet:
                payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
              filePath: payload.filePath,
              languageId: payload.languageId,
            });

            this.errorLoggingService.logError(error);
            this.eventBus.publish(OutboundEvents.error, {
              code: error.code,
              message: this.errorRecoveryService.getUserFriendlyMessage(error),
              suggestion: this.errorRecoveryService.getActionableSuggestion(error),
            });
          }
        });
    } catch (error: any) {
      const providerError = ProviderError.fromError(error, payload.providerId);

      console.error("[QWIKI]", `Exception in handleGenerateWiki`, {
        code: providerError.code,
        message: providerError.message,
        providerId: payload.providerId,
        snippet: payload.snippet?.substring(0, 100) + (payload.snippet?.length > 100 ? "..." : ""),
        filePath: payload.filePath,
        languageId: payload.languageId,
        originalError: error,
      });

      this.errorLoggingService.logError(providerError);
      this.eventBus.publish(OutboundEvents.error, {
        code: providerError.code,
        message: this.errorRecoveryService.getUserFriendlyMessage(providerError),
        suggestion: this.errorRecoveryService.getActionableSuggestion(providerError),
      });
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

      console.error("[QWIKI]", `Exception in handleGetRelated`, {
        code: providerError.code,
        message: providerError.message,
        filePath: _payload?.filePath,
        originalError: error,
      });

      this.errorLoggingService.logError(providerError);
      this.eventBus.publish(OutboundEvents.error, {
        code: providerError.code,
        message: this.errorRecoveryService.getUserFriendlyMessage(providerError),
        suggestion: this.errorRecoveryService.getActionableSuggestion(providerError),
      });
    }
  }
}
