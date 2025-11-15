import type { Command } from "@/application/commands/Command";
import type { EventBus } from "@/events";
import { MessageBusService } from "@/application/services/core/MessageBusService";

export interface GetProviderPerformancePayload {
  providerId?: string;
}

export class GetProviderPerformanceCommand implements Command<GetProviderPerformancePayload> {
  constructor(
    private providerPerformanceService: import("@/infrastructure/services/providers/ProviderPerformanceService").ProviderPerformanceService,
    private messageBus: MessageBusService,
  ) {}

  async execute(payload: GetProviderPerformancePayload): Promise<void> {
    try {
      let performanceStats;

      if (payload.providerId) {
        performanceStats = this.providerPerformanceService.getProviderStats(payload.providerId);
      } else {
        performanceStats = this.providerPerformanceService.getAllProviderStats();
      }

      this.messageBus.postSuccess("providerPerformanceRetrieved", {
        performanceStats,
      });
    } catch (error) {
      this.messageBus.postError(
        `Failed to get provider performance: ${error instanceof Error ? error.message : String(error)}`,
        "PERFORMANCE_GET_ERROR",
      );
    }
  }
}
