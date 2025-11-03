import type { Command } from "./Command";
import type { ReadmeUpdateService } from "../services/ReadmeUpdateService";
import type { MessageBusService } from "../services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class CancelReadmeUpdateCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("CancelReadmeUpdateCommand", loggingService);
  }

  async execute(): Promise<void> {
    try {
      this.logger.debug("Cancelling pending README update");

      await this.readmeUpdateService.cancelPendingUpdate();

      await this.messageBus.postMessage("readmeUpdateCancelled", {
        success: true,
      });

      await this.messageBus.postMessage("showNotification", {
        type: "info",
        message: "README update cancelled",
      });

      this.logger.debug("README update cancellation completed");
    } catch (error) {
      this.logger.error("Failed to cancel README update", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to cancel README update: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
