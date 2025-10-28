import type { EventBus } from "../EventBus";
import type { WikiGenerationRequest } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import { InboundEvents, OutboundEvents, LoadingSteps } from "../../constants/Events";
import type { LoadingStep } from "../../constants/Events";
import { ErrorCodes, ErrorMessages } from "../../constants";

export class WikiEventHandler {
  constructor(
    private eventBus: EventBus,
    private wikiService: any,
    private projectContextService: any,
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
            this.eventBus.publish(OutboundEvents.error, {
              code: ErrorCodes.generationFailed,
              message: result.error || ErrorMessages[ErrorCodes.generationFailed],
            });
          }
        });
    } catch (error: any) {
      this.eventBus.publish(OutboundEvents.error, {
        code: ErrorCodes.generationFailed,
        message: error?.message || ErrorMessages[ErrorCodes.generationFailed],
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
      this.eventBus.publish(OutboundEvents.error, {
        code: ErrorCodes.unknown,
        message: error?.message || ErrorMessages[ErrorCodes.unknown],
      });
    }
  }
}
