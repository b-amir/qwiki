import type { Command } from "@/application/commands/Command";
import type { EventBus } from "@/events";
import { MessageBusService } from "@/application/services/core/MessageBusService";

export interface GetProviderHealthPayload {
  providerId?: string;
}

export class GetProviderHealthCommand implements Command<GetProviderHealthPayload> {
  constructor(
    private providerHealthService: import("@/infrastructure/services/providers/ProviderHealthService").ProviderHealthService,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: GetProviderHealthPayload): Promise<void> {
    try {
      let healthStatus;

      if (payload.providerId) {
        healthStatus = await this.providerHealthService.checkProviderHealth(payload.providerId);
      } else {
        healthStatus = this.providerHealthService.getAllHealthStatus();
      }

      this.messageBus.postSuccess("providerHealthRetrieved", {
        healthStatus,
      });
    } catch (error) {
      this.messageBus.postError(
        `Failed to get provider health: ${error instanceof Error ? error.message : String(error)}`,
        "HEALTH_CHECK_ERROR",
      );
    }
  }
}
