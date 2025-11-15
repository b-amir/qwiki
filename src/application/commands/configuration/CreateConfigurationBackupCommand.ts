import type { Command } from "@/application/commands/Command";
import type { EventBus } from "@/events";
import { MessageBusService } from "@/application/services/core/MessageBusService";

export interface CreateConfigurationBackupPayload {
  description?: string;
}

export class CreateConfigurationBackupCommand implements Command<CreateConfigurationBackupPayload> {
  constructor(
    private configurationBackupService: import("@/infrastructure/services/storage/ConfigurationBackupService").ConfigurationBackupService,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: CreateConfigurationBackupPayload): Promise<void> {
    try {
      const backup = await this.configurationBackupService.createBackup(payload.description);

      this.messageBus.postSuccess("configurationBackupCreated", {
        backupId: backup.id,
        createdAt: backup.createdAt,
        description: backup.description,
      });
    } catch (error) {
      this.messageBus.postError(
        `Failed to create configuration backup: ${error instanceof Error ? error.message : String(error)}`,
        "BACKUP_CREATE_ERROR",
      );
    }
  }
}
