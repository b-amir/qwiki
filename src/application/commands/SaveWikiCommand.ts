import type { Command } from "./Command";
import type { WikiStorageService } from "../services/WikiStorageService";
import type { MessageBus } from "../services/MessageBus";
import { LoggingService } from "../../infrastructure/services/LoggingService";
import { LoggingService } from "../../infrastructure/services/LoggingService";

interface SaveWikiPayload {
  title: string;
  content: string;
  sourceFilePath?: string;
}

export class SaveWikiCommand implements Command<SaveWikiPayload> {
  constructor(
    private wikiStorageService: WikiStorageService,
    private messageBus: MessageBus,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {}

  private readonly serviceName = "SaveWikiCommand";

  private logDebug(message: string, data?: unknown): void {
    this.loggingService.debug(this.serviceName, message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.loggingService.error(this.serviceName, message, data);
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
