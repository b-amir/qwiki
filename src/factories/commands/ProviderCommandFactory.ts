import type { Command } from "@/application/commands/Command";
import {
  SaveApiKeyCommand,
  GetProvidersCommand,
  DeleteApiKeyCommand,
  GetApiKeysCommand,
  GetProviderConfigsCommand,
  GetProviderCapabilitiesCommand,
  GetProviderHealthCommand,
  GetProviderPerformanceCommand,
  ValidateApiKeysCommand,
  ValidateApiKeyHealthCommand,
  SetActiveProviderCommand,
} from "../../application/commands";
import { CommandIds } from "@/constants";
import { BaseCommandFactory } from "@/factories/commands/BaseCommandFactory";

export class ProviderCommandFactory extends BaseCommandFactory {
  async createCommand<T>(commandId: string): Promise<Command<T> | undefined> {
    switch (commandId) {
      case CommandIds.saveApiKey:
        return new SaveApiKeyCommand(
          this.container.resolve("apiKeyRepository"),
          this.messageBus,
          await this.container.resolveLazy("llmRegistry"),
          await this.container.resolveLazy("providerValidationService"),
          await this.container.resolveLazy("providerModelCatalogService"),
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getProviders:
        return new GetProvidersCommand(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("apiKeyRepository"),
          this.container.resolve("configurationManager"),
          await this.container.resolveLazy("providerModelCatalogService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.deleteApiKey:
        return new DeleteApiKeyCommand(
          this.container.resolve("apiKeyRepository"),
          this.messageBus,
          await this.container.resolveLazy("providerValidationService"),
          await this.container.resolveLazy("providerModelCatalogService"),
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getApiKeys:
        return new GetApiKeysCommand(
          this.container.resolve("apiKeyRepository"),
          this.container.resolve("configurationRepository"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getProviderConfigs:
        return new GetProviderConfigsCommand(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("configurationManager"),
          await this.container.resolveLazy("providerModelCatalogService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getProviderCapabilities:
        return new GetProviderCapabilitiesCommand(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("configurationManager"),
          await this.container.resolveLazy("providerModelCatalogService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.getProviderHealth:
        return new GetProviderHealthCommand(
          await this.container.resolveLazy("providerHealthService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.getProviderPerformance:
        return new GetProviderPerformanceCommand(
          await this.container.resolveLazy("providerPerformanceService"),
          this.messageBus,
        ) as Command<T>;

      case CommandIds.validateApiKeys:
        return new ValidateApiKeysCommand(
          await this.container.resolveLazy("providerValidationService"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.validateApiKeyHealth:
        return new ValidateApiKeyHealthCommand(
          await this.container.resolveLazy("llmRegistry"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      case CommandIds.setActiveProvider:
        return new SetActiveProviderCommand(
          this.container.resolve("configurationManager"),
          this.messageBus,
          this.loggingService,
        ) as Command<T>;

      default:
        return undefined;
    }
  }

  getSupportedCommands(): string[] {
    return [
      CommandIds.saveApiKey,
      CommandIds.getProviders,
      CommandIds.deleteApiKey,
      CommandIds.getApiKeys,
      CommandIds.getProviderConfigs,
      CommandIds.getProviderCapabilities,
      CommandIds.getProviderHealth,
      CommandIds.getProviderPerformance,
      CommandIds.validateApiKeys,
      CommandIds.validateApiKeyHealth,
      CommandIds.setActiveProvider,
    ];
  }
}
