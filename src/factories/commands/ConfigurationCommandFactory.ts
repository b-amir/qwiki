import type { Command } from "@/application/commands/Command";
import {
  GetConfigurationCommand,
  UpdateConfigurationCommand,
  ValidateConfigurationCommand,
  ApplyConfigurationTemplateCommand,
  GetConfigurationTemplatesCommand,
  CreateConfigurationBackupCommand,
  GetConfigurationBackupsCommand,
} from "../../application/commands";
import { CommandIds } from "@/constants";
import { BaseCommandFactory } from "@/factories/commands/BaseCommandFactory";

export class ConfigurationCommandFactory extends BaseCommandFactory {
  async createCommand<T>(commandId: string): Promise<Command<T> | undefined> {
    switch (commandId) {
      case CommandIds.getConfiguration:
        return new GetConfigurationCommand(
          this.container.resolve("configurationManager"),
        ) as Command<T>;

      case CommandIds.updateConfiguration:
        return new UpdateConfigurationCommand(
          this.container.resolve("configurationManager"),
        ) as Command<T>;

      case CommandIds.validateConfiguration:
        return new ValidateConfigurationCommand(
          this.container.resolve("configurationValidator"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.applyConfigurationTemplate:
        return new ApplyConfigurationTemplateCommand(
          this.container.resolve("configurationTemplateService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.getConfigurationTemplates:
        return new GetConfigurationTemplatesCommand(
          this.container.resolve("configurationTemplateService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.createConfigurationBackup:
        return new CreateConfigurationBackupCommand(
          this.container.resolve("configurationBackupService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.getConfigurationBackups:
        return new GetConfigurationBackupsCommand(
          this.container.resolve("configurationBackupService"),
          this.messageBus,
        ) as Command<T>;

      default:
        return undefined;
    }
  }

  getSupportedCommands(): string[] {
    return [
      CommandIds.getConfiguration,
      CommandIds.updateConfiguration,
      CommandIds.validateConfiguration,
      CommandIds.applyConfigurationTemplate,
      CommandIds.getConfigurationTemplates,
      CommandIds.createConfigurationBackup,
      CommandIds.getConfigurationBackups,
    ];
  }
}
