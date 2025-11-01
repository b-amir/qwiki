import type { Command } from "./Command";
import type { WikiAggregationService } from "../services/WikiAggregationService";
import type { MessageBusService } from "../services/MessageBusService";
import type { AggregationConfig } from "../../domain/entities/WikiAggregation";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface CreateAggregationPayload {
  wikiIds: string[];
  config: AggregationConfig;
  title?: string;
}

export class CreateAggregationCommand implements Command<CreateAggregationPayload> {
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
    this.logger = createLogger("CreateAggregationCommand", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: CreateAggregationPayload): Promise<void> {
    try {
      this.logDebug("Creating aggregation", { wikiCount: payload.wikiIds.length });

      if (!payload.wikiIds || payload.wikiIds.length === 0) {
        throw new Error("At least one wiki ID is required");
      }

      if (!payload.config) {
        throw new Error("Aggregation config is required");
      }

      const aggregation = await this.aggregationService.createAggregation(
        payload.wikiIds,
        payload.config,
      );

      if (payload.title && aggregation.id) {
        const updated = await this.aggregationService.updateAggregation(aggregation.id, {
          title: payload.title,
        });

        await this.messageBus.postMessage("aggregationCreated", {
          aggregation: updated,
          success: true,
        });
      } else {
        await this.messageBus.postMessage("aggregationCreated", {
          aggregation,
          success: true,
        });
      }

      this.logDebug("Aggregation created successfully", { id: aggregation.id });
    } catch (error) {
      this.logError("Failed to create aggregation", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to create aggregation: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
