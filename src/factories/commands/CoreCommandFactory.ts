import type { Command } from "@/application/commands/Command";
import {
  GenerateWikiCommand,
  GetSelectionCommand,
  GetRelatedCommand,
} from "../../application/commands";
import { CommandIds } from "@/constants";
import {
  BaseCommandFactory,
  type CommandFactoryDependencies,
} from "@/factories/commands/BaseCommandFactory";

export class CoreCommandFactory extends BaseCommandFactory {
  async createCommand<T>(commandId: string): Promise<Command<T> | undefined> {
    switch (commandId) {
      case CommandIds.generateWiki:
        return new GenerateWikiCommand(this.eventBus, this.loggingService) as Command<T>;

      case CommandIds.getSelection:
        return new GetSelectionCommand(this.eventBus) as Command<T>;

      case CommandIds.getRelated:
        return new GetRelatedCommand(this.eventBus) as Command<T>;

      default:
        return undefined;
    }
  }

  getSupportedCommands(): string[] {
    return [CommandIds.generateWiki, CommandIds.getSelection, CommandIds.getRelated];
  }
}
