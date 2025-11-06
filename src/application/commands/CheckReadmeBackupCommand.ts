import type { Command } from "./Command";
import type { ReadmeUpdateService } from "../services/ReadmeUpdateService";
import type { MessageBusService } from "../services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class CheckReadmeBackupCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("CheckReadmeBackupCommand");
  }

  async execute(): Promise<void> {
    try {
      this.logger.debug("Checking README backup state");

      const hasBackup = this.readmeUpdateService.getBackupState();

      await this.messageBus.postMessage("readmeBackupState", {
        hasBackup,
      });

      this.logger.debug("README backup state checked", { hasBackup });
    } catch (error) {
      this.logger.error("Failed to check README backup state", error);
    }
  }
}
