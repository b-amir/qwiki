import type { Command } from "@/application/commands/Command";
import type { ReadmeUpdateService } from "@/application/services/readme/ReadmeUpdateService";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class UndoReadmeCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("UndoReadmeCommand");
  }

  async execute(): Promise<void> {
    try {
      this.logger.debug("Undoing README update");

      const result = await this.readmeUpdateService.undoReadmeUpdate();

      if (result.success) {
        await this.messageBus.postMessage("readmeUpdated", {
          result: { success: true, changes: ["README restored from backup"] },
          success: true,
        });

        await this.messageBus.postMessage("showNotification", {
          type: "success",
          message: "README restored from backup",
        });

        this.logger.info("README undo completed successfully");
      } else {
        await this.messageBus.postMessage("showNotification", {
          type: "error",
          message: result.error || "Failed to restore README from backup",
        });

        this.logger.error("Failed to undo README update", { error: result.error });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to undo README update", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to undo README update: ${errorMessage}`,
      });
      throw error;
    }
  }
}
