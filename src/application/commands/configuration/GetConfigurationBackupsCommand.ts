import type { Command } from "@/application/commands/Command";
import type { MessageBusService } from "@/application/services/core/MessageBusService";

export class GetConfigurationBackupsCommand implements Command<void> {
  constructor(
    private configurationBackupService: import("@/infrastructure/services/storage/ConfigurationBackupService").ConfigurationBackupService,
    private messageBus: MessageBusService,
  ) {}

  async execute(): Promise<void> {
    try {
      const backups = await this.configurationBackupService.listBackups();
      this.messageBus.postSuccess("configurationBackups", { backups });
    } catch (error) {
      this.messageBus.postError(
        `Failed to get configuration backups: ${error instanceof Error ? error.message : String(error)}`,
        "GET_BACKUPS_ERROR",
      );
    }
  }
}
