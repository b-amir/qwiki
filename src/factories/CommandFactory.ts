import type { Command } from "../application/commands/Command";
import type { Container } from "../container/Container";
import type { EventBus } from "../events";
import type { Webview } from "vscode";
import {
  GenerateWikiCommand,
  GetSelectionCommand,
  GetRelatedCommand,
  SaveApiKeyCommand,
  GetProvidersCommand,
  OpenFileCommand,
  SaveSettingCommand,
  DeleteApiKeyCommand,
  GetApiKeysCommand,
  GetProviderConfigsCommand,
  GetConfigurationCommand,
  UpdateConfigurationCommand,
} from "../application/commands";
import { MessageBus } from "../application/services/MessageBus";
import { CommandIds } from "../constants";

export interface CommandFactoryDependencies {
  container: Container;
  webview: Webview;
  eventBus: EventBus;
}

export class CommandFactory {
  private dependencies: CommandFactoryDependencies;
  private messageBus: MessageBus;

  constructor(dependencies: CommandFactoryDependencies) {
    this.dependencies = dependencies;
    this.messageBus = new MessageBus(dependencies.webview);
  }

  async createCommand<T>(commandId: string): Promise<Command<T> | undefined> {
    const { container, eventBus } = this.dependencies;

    switch (commandId) {
      case CommandIds.generateWiki:
        return new GenerateWikiCommand(eventBus) as Command<T>;

      case CommandIds.getSelection:
        return new GetSelectionCommand(eventBus) as Command<T>;

      case CommandIds.getRelated:
        return new GetRelatedCommand(eventBus) as Command<T>;

      case CommandIds.saveApiKey:
        return new SaveApiKeyCommand(
          container.resolve("apiKeyRepository"),
          this.messageBus
        ) as Command<T>;

      case CommandIds.getProviders:
        return new GetProvidersCommand(
          await container.resolveLazy("llmRegistry"),
          container.resolve("apiKeyRepository"),
          this.messageBus
        ) as Command<T>;

      case CommandIds.openFile:
        return new OpenFileCommand() as Command<T>;

      case CommandIds.saveSetting:
        return new SaveSettingCommand(
          container.resolve("configurationRepository"),
          this.messageBus
        ) as Command<T>;

      case CommandIds.deleteApiKey:
        return new DeleteApiKeyCommand(
          container.resolve("apiKeyRepository"),
          this.messageBus
        ) as Command<T>;

      case CommandIds.getApiKeys:
        return new GetApiKeysCommand(
          container.resolve("apiKeyRepository"),
          container.resolve("configurationRepository"),
          this.messageBus
        ) as Command<T>;

      case CommandIds.getProviderConfigs:
        return new GetProviderConfigsCommand(
          await container.resolveLazy("llmRegistry"),
          this.messageBus
        ) as Command<T>;

      case CommandIds.getConfiguration:
        return new GetConfigurationCommand(
          container.resolve("configurationManager")
        ) as Command<T>;

      case CommandIds.updateConfiguration:
        return new UpdateConfigurationCommand(
          container.resolve("configurationManager")
        ) as Command<T>;

      default:
        return undefined;
    }
  }

  async createAllCommands(): Promise<Record<string, Command>> {
    const commands: Record<string, Command> = {};
    
    const commandIds = [
      CommandIds.generateWiki,
      CommandIds.getSelection,
      CommandIds.getRelated,
      CommandIds.saveApiKey,
      CommandIds.getProviders,
      CommandIds.openFile,
      CommandIds.saveSetting,
      CommandIds.deleteApiKey,
      CommandIds.getApiKeys,
      CommandIds.getProviderConfigs,
      CommandIds.getConfiguration,
      CommandIds.updateConfiguration,
    ];

    for (const commandId of commandIds) {
      const command = await this.createCommand(commandId);
      if (command) {
        commands[commandId] = command;
      }
    }

    return commands;
  }
}