import type { Command } from "./Command";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";
import { ConfigurationKeys, ConfigurationDefaults, ProviderIds } from "../../constants";

export class GetApiKeysCommand implements Command<void> {
  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private configurationRepository: ConfigurationRepository,
    private messageBus: MessageBus,
  ) {}

  async execute(): Promise<void> {
    const [zaiKey, openrouterKey, googleAIStudioKey, cohereKey, huggingfaceKey] = await Promise.all(
      [
        this.apiKeyRepository.get(ProviderIds.zai),
        this.apiKeyRepository.get(ProviderIds.openrouter),
        this.apiKeyRepository.get(ProviderIds.googleAIStudio),
        this.apiKeyRepository.get(ProviderIds.cohere),
        this.apiKeyRepository.get(ProviderIds.huggingface),
      ],
    );

    const [zaiBaseUrl, googleAIEndpoint] = await Promise.all([
      this.configurationRepository.get<string>(ConfigurationKeys.zaiBaseUrl),
      this.configurationRepository.get<string>(ConfigurationKeys.googleAIEndpoint),
    ]);

    const payload = {
      zaiKey,
      openrouterKey,
      googleAIStudioKey,
      cohereKey,
      huggingfaceKey,
      zaiBaseUrl: zaiBaseUrl || ConfigurationDefaults[ConfigurationKeys.zaiBaseUrl],
      googleAIEndpoint:
        googleAIEndpoint || ConfigurationDefaults[ConfigurationKeys.googleAIEndpoint],
    };

    this.messageBus.postSuccess(OutboundEvents.apiKeys, payload);
  }
}
