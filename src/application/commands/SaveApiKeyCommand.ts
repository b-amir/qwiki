import type { Command } from "./Command";
import type { ConfigurationManagerService } from "../services";
import type { MessageBusService } from "../services/MessageBusService";
import { OutboundEvents } from "../../constants/Events";

interface SaveApiKeyPayload {
  providerId: string;
  apiKey: string;
}

export class SaveApiKeyCommand implements Command<SaveApiKeyPayload> {
  constructor(
    private configManager: ConfigurationManagerService,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: SaveApiKeyPayload): Promise<void> {
    const providerConfig = await this.configManager.getProviderConfig(payload.providerId);
    const updatedConfig = {
      id: payload.providerId,
      name: providerConfig?.name || payload.providerId,
      enabled: providerConfig?.enabled ?? true,
      apiKey: payload.apiKey,
      model: providerConfig?.model,
      temperature: providerConfig?.temperature,
      maxTokens: providerConfig?.maxTokens,
      topP: providerConfig?.topP,
      frequencyPenalty: providerConfig?.frequencyPenalty,
      presencePenalty: providerConfig?.presencePenalty,
      customFields: providerConfig?.customFields,
      rateLimitPerMinute: providerConfig?.rateLimitPerMinute,
      timeout: providerConfig?.timeout,
      retryAttempts: providerConfig?.retryAttempts,
      fallbackProviderIds: providerConfig?.fallbackProviderIds,
    };
    await this.configManager.setProviderConfig(payload.providerId, updatedConfig);
    this.messageBus.postSuccess(OutboundEvents.apiKeySaved, { providerId: payload.providerId });
  }
}
