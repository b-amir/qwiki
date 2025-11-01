import type { Command } from "./Command";
import type { WikiStorageService } from "../services/WikiStorageService";
import type { MessageBusService } from "../services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface GetSavedWikisPayload {}

export class GetSavedWikisCommand implements Command<GetSavedWikisPayload> {
  private logger: Logger;

  constructor(
    private wikiStorageService: WikiStorageService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("GetSavedWikisCommand", loggingService);
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
      this.logDebug("Retrieved saved wikis", { count: wikis.length });

      await this.messageBus.postMessage("savedWikisLoaded", { wikis });
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
