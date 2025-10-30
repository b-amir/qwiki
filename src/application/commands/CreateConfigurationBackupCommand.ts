import type { Command } from "./Command";
import type { EventBus } from "../../events";
import { MessageBus } from "../services/MessageBus";

export interface CreateConfigurationBackupPayload {
  description?: string;
}

export class CreateConfigurationBackupCommand implements Command<CreateConfigurationBackupPayload> {
  constructor(
    private configurationBackupService: import("../../infrastructure/services/ConfigurationBackupService").ConfigurationBackupService,
    private messageBus: MessageBus,
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
