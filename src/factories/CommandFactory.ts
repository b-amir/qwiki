import type { Command } from "@/application/commands/Command";
import type { CommandFactoryDependencies } from "@/factories/commands";
import {
  CoreCommandFactory,
  ProviderCommandFactory,
  ConfigurationCommandFactory,
  WikiCommandFactory,
  ReadmeCommandFactory,
  UtilityCommandFactory,
  BaseCommandFactory,
} from "./commands";

export class CommandFactory {
  private factories: BaseCommandFactory[];

  constructor(dependencies: CommandFactoryDependencies) {
    this.factories = [
      new CoreCommandFactory(dependencies),
      new ProviderCommandFactory(dependencies),
      new ConfigurationCommandFactory(dependencies),
      new WikiCommandFactory(dependencies),
      new ReadmeCommandFactory(dependencies),
      new UtilityCommandFactory(dependencies),
    ];
  }

  async createCommand<T>(commandId: string): Promise<Command<T> | undefined> {
    for (const factory of this.factories) {
      if (factory.getSupportedCommands().includes(commandId)) {
        return factory.createCommand<T>(commandId);
      }
    }
    return undefined;
  }

  async createAllCommands(): Promise<Record<string, Command>> {
    const commands: Record<string, Command> = {};

    const allCommandIds = new Set<string>();
    for (const factory of this.factories) {
      for (const commandId of factory.getSupportedCommands()) {
        allCommandIds.add(commandId);
      }
    }

    for (const commandId of allCommandIds) {
      const command = await this.createCommand(commandId);
      if (command) {
        commands[commandId] = command;
      }
    }

    return commands;
  }
}
