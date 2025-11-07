import type { Command } from "./Command";
import type { LLMRegistry } from "../../llm";
import type { ProviderId } from "../../llm/types";
import type { MessageBusService } from "../services/MessageBusService";
import type { ConfigurationManagerService } from "../services/ConfigurationManagerService";
import { OutboundEvents } from "../../constants/Events";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export interface GetProviderCapabilitiesPayload {
  providerId?: string;
  model?: string;
}

export class GetProviderCapabilitiesCommand implements Command<GetProviderCapabilitiesPayload> {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private configurationManager: ConfigurationManagerService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("GetProviderCapabilitiesCommand");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload?: GetProviderCapabilitiesPayload): Promise<void> {
    const executeStartTime = Date.now();
    this.logDebug("Starting to get provider capabilities", payload);

    try {
      const capabilitiesStartTime = Date.now();
      const allCapabilities: Record<string, any> = {};

      // Get all providers from registry
      const providers = this.llmRegistry.list();

      for (const providerInfo of providers) {
        const provider = this.llmRegistry.getProvider(providerInfo.id as ProviderId);
        if (!provider) continue;

        try {
          // Get the currently selected model for this provider from configuration
          const providerConfig = await this.configurationManager.getProviderConfig(providerInfo.id);
          const selectedModel =
            payload?.providerId === providerInfo.id && payload?.model
              ? payload.model
              : providerConfig?.model || provider.listModels()[0];

          // Get model-specific capabilities if available, otherwise use default
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
          // Fallback to default capabilities
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
