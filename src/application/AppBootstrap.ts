import { Container } from "../container/Container";
import {
  CommandRegistry,
  SelectionService,
  ProjectContextService,
  WikiService,
  MessageBus,
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
} from "./";
import { VSCodeApiKeyRepository, VSCodeConfigurationRepository } from "../infrastructure";
import { LLMRegistry } from "../llm";
import { CommandIds, ConfigurationKeys, Extension } from "../constants";
import type { ExtensionContext, Webview } from "vscode";
import { workspace } from "vscode";

export class AppBootstrap {
  private container = new Container();

  constructor(private context: ExtensionContext) {
    this.registerServices();
  }

  private registerServices(): void {
    this.container.registerInstance("context", this.context);
    this.container.registerInstance("secrets", this.context.secrets);

    this.container.register(
      "apiKeyRepository",
      () => new VSCodeApiKeyRepository(this.container.resolve("secrets")),
    );

    this.container.register("configurationRepository", () => new VSCodeConfigurationRepository());

    this.container.register("selectionService", () => new SelectionService());

    this.container.register("projectContextService", () => new ProjectContextService());

    this.container.register("llmRegistry", () => {
      const configuration = workspace.getConfiguration(Extension.configurationSection);
      return new LLMRegistry(this.container.resolve("secrets"), {
        zaiBaseUrl: configuration.get<string>(ConfigurationKeys.zaiBaseUrl),
        googleAIEndpoint: configuration.get<string>(ConfigurationKeys.googleAIEndpoint),
      });
    });

    this.container.register(
      "wikiService",
      () => new WikiService(this.container.resolve("llmRegistry")),
    );

    this.container.register("commandRegistry", () => new CommandRegistry());
  }

  createCommandRegistry(webview: Webview): CommandRegistry {
    const commandRegistry = new CommandRegistry();
    const messageBus = new MessageBus(webview);

    commandRegistry.register(
      CommandIds.generateWiki,
      new GenerateWikiCommand(
        this.container.resolve("wikiService"),
        this.container.resolve("projectContextService"),
        messageBus,
      ),
    );

    commandRegistry.register(
      CommandIds.getSelection,
      new GetSelectionCommand(this.container.resolve("selectionService"), messageBus),
    );

    commandRegistry.register(
      CommandIds.getRelated,
      new GetRelatedCommand(
        this.container.resolve("selectionService"),
        this.container.resolve("projectContextService"),
        messageBus,
      ),
    );

    commandRegistry.register(
      CommandIds.saveApiKey,
      new SaveApiKeyCommand(this.container.resolve("apiKeyRepository"), messageBus),
    );

    commandRegistry.register(
      CommandIds.getProviders,
      new GetProvidersCommand(
        this.container.resolve("llmRegistry"),
        this.container.resolve("apiKeyRepository"),
        messageBus,
      ),
    );

    commandRegistry.register(CommandIds.openFile, new OpenFileCommand());

    commandRegistry.register(
      CommandIds.saveSetting,
      new SaveSettingCommand(this.container.resolve("configurationRepository"), messageBus),
    );

    commandRegistry.register(
      CommandIds.deleteApiKey,
      new DeleteApiKeyCommand(this.container.resolve("apiKeyRepository"), messageBus),
    );

    commandRegistry.register(
      CommandIds.getApiKeys,
      new GetApiKeysCommand(
        this.container.resolve("apiKeyRepository"),
        this.container.resolve("configurationRepository"),
        messageBus,
      ),
    );

    commandRegistry.register(
      CommandIds.getProviderConfigs,
      new GetProviderConfigsCommand(this.container.resolve("llmRegistry"), messageBus),
    );

    return commandRegistry;
  }

  getContainer(): Container {
    return this.container;
  }
}
