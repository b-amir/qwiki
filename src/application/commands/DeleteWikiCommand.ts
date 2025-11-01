import type { Command } from "./Command";
import type { WikiStorageService } from "../services/WikiStorageService";
import type { MessageBus } from "../services/MessageBus";
import { LoggingService } from "../../infrastructure/services/LoggingService";

interface DeleteWikiPayload {
  wikiId: string;
}

export class DeleteWikiCommand implements Command<DeleteWikiPayload> {
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

  private readonly serviceName = "DeleteWikiCommand";

  private logDebug(message: string, data?: unknown): void {
    this.loggingService.debug(this.serviceName, message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.loggingService.error(this.serviceName, message, data);
  }

  async execute(payload: DeleteWikiPayload): Promise<void> {
    try {
      this.logDebug("Starting to delete wiki", payload.wikiId);
      await this.wikiStorageService.deleteWiki(payload.wikiId);
      this.logDebug("Wiki deleted successfully");

      await this.messageBus.postMessage("wikiDeleted", {
        wikiId: payload.wikiId,
      });
      this.logDebug("Sent wikiDeleted message");

      await this.messageBus.postMessage("showNotification", {
        type: "info",
        message: "Wiki deleted successfully",
      });
      this.logDebug("Sent success notification");
    } catch (error) {
      this.logError("Failed to delete wiki", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to delete wiki: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
