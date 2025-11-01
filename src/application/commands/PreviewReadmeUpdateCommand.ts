import type { Command } from "./Command";
import type { ReadmeUpdateService } from "../services/ReadmeUpdateService";
import type { MessageBusService } from "../services/MessageBusService";
import type { ReadmeUpdateConfig } from "../../domain/entities/ReadmeUpdate";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface PreviewReadmeUpdatePayload {
  wikiIds: string[];
  config: ReadmeUpdateConfig;
}

export class PreviewReadmeUpdateCommand implements Command<PreviewReadmeUpdatePayload> {
  private logger: Logger;

  constructor(
    private readmeUpdateService: ReadmeUpdateService,
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService({
      enabled: true,
      level: "debug",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("PreviewReadmeUpdateCommand", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: PreviewReadmeUpdatePayload): Promise<void> {
    try {
      this.logDebug("Generating README preview", { wikiCount: payload.wikiIds.length });

      if (!payload.wikiIds || payload.wikiIds.length === 0) {
        throw new Error("At least one wiki ID is required");
      }

      if (!payload.config) {
        throw new Error("Readme update config is required");
      }

      const preview = await this.readmeUpdateService.previewReadmeUpdate(
        payload.wikiIds,
        payload.config,
      );

      await this.messageBus.postMessage("readmePreviewGenerated", {
        preview,
        success: true,
      });

      this.logDebug("README preview generated successfully");
    } catch (error) {
      this.logError("Failed to generate README preview", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to generate preview: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
