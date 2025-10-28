import type { Command } from "./Command";
import type { WikiService } from "../services/WikiService";
import type { ProjectContextService } from "../services/ProjectContextService";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";
import { ErrorCodes, ErrorMessages } from "../../constants";

interface GenerateWikiPayload {
  providerId: string;
  model?: string;
  snippet: string;
  languageId?: string;
  filePath?: string;
}

export class GenerateWikiCommand implements Command<GenerateWikiPayload> {
  constructor(
    private wikiService: WikiService,
    private projectContextService: ProjectContextService,
    private messageBus: MessageBus,
  ) {}

  async execute(payload: GenerateWikiPayload): Promise<void> {
    try {
      const projectContext = await this.projectContextService.buildContext(
        payload.snippet,
        payload.filePath,
        payload.languageId,
      );

      const result = await this.wikiService.generateWiki(
        {
          snippet: payload.snippet,
          languageId: payload.languageId,
          filePath: payload.filePath,
          providerId: payload.providerId,
          model: payload.model,
        },
        projectContext,
        (step) => this.messageBus.postLoadingStep(step),
      );

      if (result.success) {
        this.messageBus.postSuccess(OutboundEvents.wikiResult, { content: result.content });
      } else {
        this.messageBus.postError(
          result.error || ErrorMessages[ErrorCodes.generationFailed],
          ErrorCodes.generationFailed,
        );
      }
    } catch (error: any) {
      this.messageBus.postError(
        error?.message || ErrorMessages[ErrorCodes.unknown],
        ErrorCodes.unknown,
      );
    }
  }
}
