import type { Command } from "./Command";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import type { MessageBusService } from "../services/MessageBusService";
import { OutboundEvents } from "../../constants/Events";
import { getAllProviderConfigs } from "../../llm/provider-config";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class GetApiKeysCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private configurationRepository: ConfigurationRepository,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("GetApiKeysCommand");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  async execute(): Promise<void> {
    const start = Date.now();
    this.logDebug("Starting to gather API keys and settings");
    const providerConfigs = getAllProviderConfigs();

    const providerIds = providerConfigs.map((p) => p.id);
    const apiKeyResults = await Promise.all(providerIds.map((id) => this.apiKeyRepository.get(id)));

    const apiKeys: Record<string, string> = {};
    for (let i = 0; i < providerIds.length; i++) {
      const key = apiKeyResults[i];
      if (key) apiKeys[providerIds[i]] = key;
    }

    const flatFields = providerConfigs.flatMap((p) => p.customFields ?? []);
    const fieldDefaults = new Map<string, string | undefined>();
    for (const f of flatFields)
      if (!fieldDefaults.has(f.id)) fieldDefaults.set(f.id, f.defaultValue);

    const fieldIds = Array.from(fieldDefaults.keys());
    const fieldValues = await Promise.all(
      fieldIds.map((id) => this.configurationRepository.get<string>(id)),
    );

    const settings: Record<string, string> = {};
    for (let i = 0; i < fieldIds.length; i++) {
      const id = fieldIds[i];
      const value = fieldValues[i];
      const fallback = fieldDefaults.get(id);
      if (value !== undefined && value !== null) settings[id] = String(value);
      else if (fallback !== undefined) settings[id] = String(fallback);
    }

    const payload = { apiKeys, settings };

    this.messageBus.postSuccess(OutboundEvents.apiKeys, payload);
    this.logDebug(
      `Sent apiKeys for ${Object.keys(apiKeys).length} providers in ${Date.now() - start}ms`,
    );
  }
}
