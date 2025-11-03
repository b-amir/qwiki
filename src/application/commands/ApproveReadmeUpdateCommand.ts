import type { Command } from "./Command";
import type { ReadmeUpdateService } from "../services/ReadmeUpdateService";
import type { MessageBusService } from "../services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class ApproveReadmeUpdateCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ApproveReadmeUpdateCommand", loggingService);
  }

  async execute(): Promise<void> {
    try {
      this.logger.debug("Approving pending README update");

      const result = await this.readmeUpdateService.approvePendingUpdate();

      if (result.success) {
        await this.messageBus.postMessage("readmeUpdateApproved", {
          result,
          success: true,
        });

        await this.messageBus.postMessage("showNotification", {
          type: "success",
          message: "README updated successfully",
        });
      } else {
        await this.messageBus.postMessage("readmeUpdateFailed", {
          result,
          success: false,
        });

        await this.messageBus.postMessage("showNotification", {
          type: "error",
          message: `Failed to update README: ${result.conflicts.join(", ")}`,
        });
      }

      this.logger.debug("README update approval completed", { success: result.success });
    } catch (error) {
      this.logger.error("Failed to approve README update", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to approve README update: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
