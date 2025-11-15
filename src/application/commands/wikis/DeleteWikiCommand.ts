import type { Command } from "@/application/commands/Command";
import type { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import type { ReadmeCacheService } from "@/application/services/readme/ReadmeCacheService";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

interface DeleteWikiPayload {
  wikiId: string;
}

export class DeleteWikiCommand implements Command<DeleteWikiPayload> {
  private logger: Logger;

  constructor(
    private wikiStorageService: WikiStorageService,
    private readmeCacheService: ReadmeCacheService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("DeleteWikiCommand");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: DeleteWikiPayload): Promise<void> {
    try {
      this.logDebug("Starting to delete wiki", payload.wikiId);
      await this.wikiStorageService.deleteWiki(payload.wikiId);

      await this.readmeCacheService.invalidateForWiki(payload.wikiId);
      this.logDebug("Invalidated README cache for deleted wiki");

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
