import type { Command } from "./Command";
import type { LLMRegistry } from "../../llm";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";
import { LoggingService, createLogger, type Logger } from "../../infrastructure/services/LoggingService";

export class GetProviderConfigsCommand implements Command<void> {
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private messageBus: MessageBus,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("GetProviderConfigsCommand", loggingService);
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

      const executeEndTime = Date.now();
      this.logDebug(
        `Command completed successfully in ${executeEndTime - executeStartTime}ms`,
      );
    } catch (error) {
      const executeEndTime = Date.now();
      this.logError(
        `Command failed after ${executeEndTime - executeStartTime}ms`,
        error,
      );
      throw error;
    }
  }
}
