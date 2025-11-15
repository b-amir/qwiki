import type { Command } from "@/application/commands/Command";
import type { ReadmeUpdateService } from "@/application/services/readme/ReadmeUpdateService";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class ShowReadmeDiffCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ShowReadmeDiffCommand");
  }

  async execute(): Promise<void> {
    try {
      this.logger.debug("Opening README diff view");
      await this.readmeUpdateService.showLatestDiff();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to open README diff";
      this.logger.error("Failed to open README diff view", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message,
      });
      throw error;
    }
  }
}
