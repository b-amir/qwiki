import type { Command } from "./Command";
import type { WikiAggregationService } from "../services/WikiAggregationService";
import type { MessageBusService } from "../services/MessageBusService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface GetAggregationsPayload {}

export class GetAggregationsCommand implements Command<GetAggregationsPayload> {
  private logger: Logger;

  constructor(
    private aggregationService: WikiAggregationService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService({
      enabled: true,
      level: "debug",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("GetAggregationsCommand", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: GetAggregationsPayload): Promise<void> {
    try {
      this.logDebug("Retrieving aggregations");

      const aggregations = this.aggregationService.getAllAggregations();

      await this.messageBus.postMessage("aggregationsLoaded", {
        aggregations,
        success: true,
      });

      this.logDebug("Aggregations retrieved", { count: aggregations.length });
    } catch (error) {
      this.logError("Failed to retrieve aggregations", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to retrieve aggregations: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
