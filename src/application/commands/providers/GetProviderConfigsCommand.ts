import type { Command } from "@/application/commands/Command";
import type { LLMRegistry } from "@/llm";
import type { ProviderId } from "@/llm/types";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import type { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import { OutboundEvents } from "@/constants/Events";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class GetProviderConfigsCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private configurationManager: ConfigurationManagerService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("GetProviderConfigsCommand");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(): Promise<void> {
    const executeStartTime = Date.now();
    this.logDebug("Starting to get provider configs");

    try {
      const configsStartTime = Date.now();
      const configs = await this.llmRegistry.getProviderConfigs();
      const configsEndTime = Date.now();

      this.logDebug(
        `Retrieved ${configs.length} provider configs in ${configsEndTime - configsStartTime}ms`,
      );

      this.messageBus.postSuccess(OutboundEvents.providerConfigs, configs);

      // Also fetch and send capabilities together to avoid flash
      const capabilitiesStartTime = Date.now();
      const allCapabilities: Record<string, any> = {};
      const providers = this.llmRegistry.list();

      for (const providerInfo of providers) {
        const provider = this.llmRegistry.getProvider(providerInfo.id as ProviderId);
        if (!provider) continue;

        try {
          const providerConfig = await this.configurationManager.getProviderConfig(providerInfo.id);
          const selectedModel = providerConfig?.model || provider.listModels()[0];

          let capabilities;
          if (provider.getModelCapabilities && selectedModel) {
            capabilities = provider.getModelCapabilities(selectedModel);
          } else {
            capabilities = provider.capabilities;
          }

          allCapabilities[providerInfo.id] = {
            streaming: capabilities.streaming,
            functionCalling: capabilities.functionCalling,
            maxTokens: capabilities.maxTokens,
            contextWindowSize: capabilities.contextWindowSize,
          };
        } catch (error) {
          this.logError(`Error getting capabilities for provider ${providerInfo.id}:`, error);
          allCapabilities[providerInfo.id] = {
            streaming: provider.capabilities.streaming,
            functionCalling: provider.capabilities.functionCalling,
            maxTokens: provider.capabilities.maxTokens,
            contextWindowSize: provider.capabilities.contextWindowSize,
          };
        }
      }

      const capabilitiesEndTime = Date.now();
      this.logDebug(
        `Retrieved capabilities for ${Object.keys(allCapabilities).length} providers in ${capabilitiesEndTime - capabilitiesStartTime}ms`,
      );

      // Send capabilities immediately after configs
      this.messageBus.postSuccess(OutboundEvents.providerCapabilitiesRetrieved, {
        capabilities: allCapabilities,
      });

      const executeEndTime = Date.now();
      this.logDebug(`Command completed successfully in ${executeEndTime - executeStartTime}ms`);
    } catch (error) {
      const executeEndTime = Date.now();
      this.logError(`Command failed after ${executeEndTime - executeStartTime}ms`, error);
      throw error;
    }
  }
}
