import type { Command } from "@/application/commands/Command";
import {
  SaveWikiCommand,
  GetSavedWikisCommand,
  DeleteWikiCommand,
} from "../../application/commands";
import { CommandIds } from "@/constants";
import { BaseCommandFactory } from "@/factories/commands/BaseCommandFactory";

export class WikiCommandFactory extends BaseCommandFactory {
  async createCommand<T>(commandId: string): Promise<Command<T> | undefined> {
    switch (commandId) {
      case CommandIds.saveWiki:
        return new SaveWikiCommand(
          this.container.resolve("wikiStorageService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getSavedWikis:
        return new GetSavedWikisCommand(
          this.container.resolve("wikiStorageService"),
          await this.container.resolveLazy("readmeUpdateService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.deleteWiki:
        return new DeleteWikiCommand(
          this.container.resolve("wikiStorageService"),
          this.container.resolve("readmeCacheService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      default:
        return undefined;
    }
  }

  getSupportedCommands(): string[] {
    return [CommandIds.saveWiki, CommandIds.getSavedWikis, CommandIds.deleteWiki];
  }
}
