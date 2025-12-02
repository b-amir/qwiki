import type { Command } from "@/application/commands/Command";
import type { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import type {
  ReadmeUpdateService,
  ReadmeStatus,
} from "@/application/services/readme/ReadmeUpdateService";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

interface GetSavedWikisPayload {}

export class GetSavedWikisCommand implements Command<GetSavedWikisPayload> {
  private logger: Logger;

  constructor(
    private wikiStorageService: WikiStorageService,
    private readmeUpdateService: ReadmeUpdateService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("GetSavedWikisCommand");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: GetSavedWikisPayload): Promise<void> {
    try {
      this.logDebug("Starting to get saved wikis");
      const wikis = await this.wikiStorageService.getAllSavedWikis();
      const wikiIds = wikis.map((wiki) => wiki.id);
      const readmeStatus: ReadmeStatus = await this.readmeUpdateService.getReadmeStatus(wikiIds);

      this.logDebug("Retrieved saved wikis", {
        count: wikis.length,
        readmeSynced: readmeStatus.isSynced,
      });

      await this.messageBus.postMessage("savedWikisLoaded", {
        wikis,
        readmeStatus,
      });
      this.logDebug("Sent savedWikisLoaded message");
    } catch (error) {
      this.logError("Failed to load saved wikis", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to load saved wikis: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
