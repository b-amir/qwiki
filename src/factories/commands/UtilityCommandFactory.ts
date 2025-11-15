import type { Command } from "@/application/commands/Command";
import {
  OpenFileCommand,
  OpenExternalCommand,
  SaveSettingCommand,
  ToggleOutputChannelCommand,
} from "../../application/commands";
import { CommandIds } from "@/constants";
import { LoggingService } from "@/infrastructure/services";
import { BaseCommandFactory } from "@/factories/commands/BaseCommandFactory";

export class UtilityCommandFactory extends BaseCommandFactory {
  async createCommand<T>(commandId: string): Promise<Command<T> | undefined> {
    switch (commandId) {
      case CommandIds.openFile:
        return new OpenFileCommand() as Command<T>;

      case CommandIds.openExternal:
        return new OpenExternalCommand(this.messageBus, this.loggingService) as Command<T>;

      case CommandIds.saveSetting:
        return new SaveSettingCommand(
          this.container.resolve("configurationRepository"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.toggleOutputChannel:
        return new ToggleOutputChannelCommand(
          this.container.resolve("loggingService") as LoggingService,
        ) as Command<T>;

      default:
        return undefined;
    }
  }

  getSupportedCommands(): string[] {
    return [
      CommandIds.openFile,
      CommandIds.openExternal,
      CommandIds.saveSetting,
      CommandIds.toggleOutputChannel,
    ];
  }
}
