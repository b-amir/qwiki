import type { Command } from "./Command";
import type { ReadmeUpdateService, ReadmeStatus } from "../services/ReadmeUpdateService";
import type { MessageBusService } from "../services/MessageBusService";
import type { WikiStorageService } from "../services/WikiStorageService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class CheckReadmeBackupCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private wikiStorageService: WikiStorageService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("CheckReadmeBackupCommand");
  }

  async execute(): Promise<void> {
    try {
      this.logger.debug("Checking README backup state");

      const wikis = await this.wikiStorageService.getAllSavedWikis();
      const readmeStatus: ReadmeStatus = await this.readmeUpdateService.getReadmeStatus(
        wikis.map((wiki) => wiki.id),
      );

      await this.messageBus.postMessage("readmeBackupState", {
        hasBackup: readmeStatus.hasBackup,
        readmeStatus,
      });

      this.logger.debug("README backup state checked", {
        hasBackup: readmeStatus.hasBackup,
        readmeSynced: readmeStatus.isSynced,
      });
    } catch (error) {
      this.logger.error("Failed to check README backup state", error);
    }
  }
}
