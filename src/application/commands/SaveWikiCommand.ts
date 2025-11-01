import type { Command } from "./Command";
import type { WikiStorageService } from "../services/WikiStorageService";
import type { MessageBusService } from "../services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface SaveWikiPayload {
  title: string;
  content: string;
  sourceFilePath?: string;
}

export class SaveWikiCommand implements Command<SaveWikiPayload> {
  private logger: Logger;

  constructor(
    private wikiStorageService: WikiStorageService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService({
      enabled: true,
      level: "debug",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("SaveWikiCommand", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: SaveWikiPayload): Promise<void> {
    try {
      this.logDebug("Starting to save wiki", {
        title: payload.title,
        contentLength: payload.content.length,
      });
      const savedWiki = await this.wikiStorageService.saveWiki(
        payload.title,
        payload.content,
        payload.sourceFilePath,
      );
      this.logDebug("Wiki saved successfully", {
        id: savedWiki.id,
        filePath: savedWiki.filePath,
      });

      await this.messageBus.postMessage("wikiSaved", {
        id: savedWiki.id,
        title: savedWiki.title,
        filePath: savedWiki.filePath,
        createdAt: savedWiki.createdAt,
      });
      this.logDebug("Sent wikiSaved message");

      await this.messageBus.postMessage("showNotification", {
        type: "success",
        message: `Wiki "${savedWiki.title}" saved successfully`,
      });
      this.logDebug("Sent success notification");
    } catch (error) {
      this.logError("Failed to save wiki", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to save wiki: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
