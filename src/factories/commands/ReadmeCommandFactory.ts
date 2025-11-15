import type { Command } from "@/application/commands/Command";
import {
  UpdateReadmeCommand,
  ShowReadmeDiffCommand,
  UndoReadmeCommand,
  CheckReadmeBackupCommand,
} from "../../application/commands";
import { CommandIds } from "@/constants";
import { BaseCommandFactory } from "@/factories/commands/BaseCommandFactory";

export class ReadmeCommandFactory extends BaseCommandFactory {
  async createCommand<T>(commandId: string): Promise<Command<T> | undefined> {
    switch (commandId) {
      case CommandIds.updateReadme:
        return new UpdateReadmeCommand(
          await this.container.resolveLazy("readmeUpdateService"),
          this.messageBus,
          this.container.resolve("configurationManager"),
          this.loggingService,
        ) as Command<T>;

      case CommandIds.showReadmeDiff:
        return new ShowReadmeDiffCommand(
          await this.container.resolveLazy("readmeUpdateService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.undoReadme:
        return new UndoReadmeCommand(
          await this.container.resolveLazy("readmeUpdateService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.checkReadmeBackupState:
        return new CheckReadmeBackupCommand(
          await this.container.resolveLazy("readmeUpdateService"),
          this.container.resolve("wikiStorageService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      default:
        return undefined;
    }
  }

  getSupportedCommands(): string[] {
    return [
      CommandIds.updateReadme,
      CommandIds.showReadmeDiff,
      CommandIds.undoReadme,
      CommandIds.checkReadmeBackupState,
    ];
  }
}
