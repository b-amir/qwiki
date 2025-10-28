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

  createCommand<T>(commandId: string): Command<T> | undefined {
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
          container.resolve("llmRegistry"),
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
          container.resolve("llmRegistry"),
          this.messageBus
        ) as Command<T>;

      default:
        return undefined;
    }
  }

  createAllCommands(): Record<string, Command> {
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
    ];

    for (const commandId of commandIds) {
      const command = this.createCommand(commandId);
      if (command) {
        commands[commandId] = command;
      }
    }

    return commands;
  }
}