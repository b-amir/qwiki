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
  OpenExternalCommand,
  SaveSettingCommand,
  DeleteApiKeyCommand,
  GetApiKeysCommand,
  GetProviderConfigsCommand,
  GetProviderCapabilitiesCommand,
  GetConfigurationCommand,
  UpdateConfigurationCommand,
  ValidateConfigurationCommand,
  ApplyConfigurationTemplateCommand,
  CreateConfigurationBackupCommand,
  GetProviderHealthCommand,
  GetProviderPerformanceCommand,
  SaveWikiCommand,
  GetSavedWikisCommand,
  DeleteWikiCommand,
  UpdateReadmeCommand,
} from "../application/commands";
import { MessageBusService } from "../application/services/MessageBusService";
import { CommandIds } from "../constants";
import { LoggingService } from "../infrastructure/services/LoggingService";

export interface CommandFactoryDependencies {
  container: Container;
  webview: Webview;
  eventBus: EventBus;
}

export class CommandFactory {
  private dependencies: CommandFactoryDependencies;
  private messageBus: MessageBusService;
  private loggingService: LoggingService;

  constructor(dependencies: CommandFactoryDependencies) {
    this.dependencies = dependencies;
    try {
      this.loggingService = this.dependencies.container.resolve("loggingService") as LoggingService;
    } catch {
      this.loggingService = new LoggingService({
        enabled: false,
        level: "error",
        includeTimestamp: true,
        includeService: true,
      });
    }
    this.messageBus = new MessageBusService(dependencies.webview, this.loggingService);
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
          container.resolve("configurationManager"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.getProviders:
        return new GetProvidersCommand(
          await container.resolveLazy("llmRegistry"),
          container.resolve("apiKeyRepository"),
          container.resolve("configurationManager"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.openFile:
        return new OpenFileCommand() as Command<T>;

      case CommandIds.openExternal:
        return new OpenExternalCommand(this.messageBus, this.loggingService) as Command<T>;

      case CommandIds.saveSetting:
        return new SaveSettingCommand(
          container.resolve("configurationRepository"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.deleteApiKey:
        return new DeleteApiKeyCommand(
          container.resolve("apiKeyRepository"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.getApiKeys:
        return new GetApiKeysCommand(
          container.resolve("apiKeyRepository"),
          container.resolve("configurationRepository"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getProviderConfigs:
        return new GetProviderConfigsCommand(
          await container.resolveLazy("llmRegistry"),
          container.resolve("configurationManager"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getProviderCapabilities:
        return new GetProviderCapabilitiesCommand(
          await container.resolveLazy("llmRegistry"),
          container.resolve("configurationManager"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getConfiguration:
        return new GetConfigurationCommand(container.resolve("configurationManager")) as Command<T>;

      case CommandIds.updateConfiguration:
        return new UpdateConfigurationCommand(
          container.resolve("configurationManager"),
        ) as Command<T>;

      case CommandIds.validateConfiguration:
        return new ValidateConfigurationCommand(
          container.resolve("configurationValidator"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.applyConfigurationTemplate:
        return new ApplyConfigurationTemplateCommand(
          container.resolve("configurationTemplateService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.createConfigurationBackup:
        return new CreateConfigurationBackupCommand(
          container.resolve("configurationBackupService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.getProviderHealth:
        return new GetProviderHealthCommand(
          await container.resolveLazy("providerHealthService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.getProviderPerformance:
        return new GetProviderPerformanceCommand(
          await container.resolveLazy("providerPerformanceService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.saveWiki:
        return new SaveWikiCommand(
          container.resolve("wikiStorageService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getSavedWikis:
        return new GetSavedWikisCommand(
          container.resolve("wikiStorageService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.deleteWiki:
        return new DeleteWikiCommand(
          container.resolve("wikiStorageService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.updateReadme:
        return new UpdateReadmeCommand(
          await container.resolveLazy("readmeUpdateService"),
          this.messageBus,
          container.resolve("configurationManager"),
          this.loggingService,
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
      CommandIds.openExternal,
      CommandIds.saveSetting,
      CommandIds.deleteApiKey,
      CommandIds.getApiKeys,
      CommandIds.getProviderConfigs,
      CommandIds.getProviderCapabilities,
      CommandIds.getConfiguration,
      CommandIds.updateConfiguration,
      CommandIds.validateConfiguration,
      CommandIds.applyConfigurationTemplate,
      CommandIds.createConfigurationBackup,
      CommandIds.getProviderHealth,
      CommandIds.getProviderPerformance,
      CommandIds.saveWiki,
      CommandIds.getSavedWikis,
      CommandIds.deleteWiki,
      CommandIds.updateReadme,
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
