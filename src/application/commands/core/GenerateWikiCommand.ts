import type { Command } from "@/application/commands/Command";
import type { EventBus } from "@/events";
import { InboundEvents } from "@/constants/Events";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

interface GenerateWikiPayload {
  providerId: string;
  model?: string;
  snippet: string;
  languageId?: string;
  filePath?: string;
}

export class GenerateWikiCommand implements Command<GenerateWikiPayload> {
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("GenerateWikiCommand");
  }

  async execute(payload: GenerateWikiPayload): Promise<void> {
    const startTime = Date.now();
    this.logger.info("GenerateWikiCommand.execute ENTRY", {
      providerId: payload.providerId,
      snippetLength: payload.snippet?.length,
      filePath: payload.filePath,
      languageId: payload.languageId,
      model: payload.model,
    });
    this.logger.debug("GenerateWikiCommand.execute started", {
      providerId: payload.providerId,
      snippetLength: payload.snippet?.length,
      filePath: payload.filePath,
      languageId: payload.languageId,
      model: payload.model,
    });

    try {
      this.logger.debug("Publishing generateWiki event", {
        event: InboundEvents.generateWiki,
      });
      await this.eventBus.publish(InboundEvents.generateWiki, payload);
      this.logger.debug("GenerateWikiCommand.execute completed", {
        duration: Date.now() - startTime,
      });
    } catch (error: unknown) {
      const errObj = error as Record<string, unknown> | null;
      this.logger.error("GenerateWikiCommand.execute failed", {
        duration: Date.now() - startTime,
        error: errObj?.message,
        stack: errObj?.stack,
      });
      throw error;
    }
  }
}
