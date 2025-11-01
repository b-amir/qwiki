import type { Command } from "./Command";
import type { WikiStorageService } from "../services/WikiStorageService";
import type { MessageBus } from "../services/MessageBus";
import { LoggingService } from "../../infrastructure/services/LoggingService";

interface GetSavedWikisPayload {}

export class GetSavedWikisCommand implements Command<GetSavedWikisPayload> {
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

  private readonly serviceName = "GetSavedWikisCommand";

  private logDebug(message: string, data?: unknown): void {
    this.loggingService.debug(this.serviceName, message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.loggingService.error(this.serviceName, message, data);
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
