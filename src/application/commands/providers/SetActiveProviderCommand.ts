import type { Command } from "@/application/commands/Command";
import type { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import { OutboundEvents } from "@/constants/Events";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

interface SetActiveProviderPayload {
  providerId: string;
  model?: string;
}

export class SetActiveProviderCommand implements Command<SetActiveProviderPayload> {
  private logger: Logger;

  constructor(
    private configurationManager: ConfigurationManagerService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("SetActiveProviderCommand");
  }

  async execute(payload: SetActiveProviderPayload): Promise<void> {
    try {
      await this.configurationManager.setActiveProvider(payload.providerId, payload.model);
      this.messageBus.postSuccess(OutboundEvents.settingSaved, {
        setting: "activeProvider",
        value: payload.providerId,
        model: payload.model,
      });
      this.logger.debug(`Active provider set to ${payload.providerId}`, { model: payload.model });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to set active provider";
      this.logger.error(`Error setting active provider to ${payload.providerId}:`, error);
      this.messageBus.postError(
        errorMessage,
        "SET_ACTIVE_PROVIDER_FAILED",
        "Please try again. If the problem persists, check VS Code permissions.",
        { providerId: payload.providerId, model: payload.model },
        errorMessage,
      );
    }
  }
}
