import type { Command } from "./Command";
import type { ReadmeUpdateService } from "../services/ReadmeUpdateService";
import type { MessageBusService } from "../services/MessageBusService";
import type { ReadmeUpdateConfig } from "../../domain/entities/ReadmeUpdate";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

interface UpdateReadmePayload {
  wikiIds: string[];
  config: ReadmeUpdateConfig;
}

export class UpdateReadmeCommand implements Command<UpdateReadmePayload> {
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
    this.logger = createLogger("UpdateReadmeCommand", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: UpdateReadmePayload): Promise<void> {
    try {
      this.logDebug("Updating README", { wikiCount: payload.wikiIds.length });

      if (!payload.wikiIds || payload.wikiIds.length === 0) {
        throw new Error("At least one wiki ID is required");
      }

      if (!payload.config) {
        throw new Error("Readme update config is required");
      }

      const result = await this.readmeUpdateService.updateReadmeFromWikis(
        payload.wikiIds,
        payload.config,
      );

      if (result.success) {
        await this.messageBus.postMessage("readmeUpdated", {
          result,
          success: true,
        });

        await this.messageBus.postMessage("showNotification", {
          type: "success",
          message: "README updated successfully",
        });
      } else {
        await this.messageBus.postMessage("readmeUpdateFailed", {
          result,
          success: false,
        });

        await this.messageBus.postMessage("showNotification", {
          type: "error",
          message: `Failed to update README: ${result.conflicts.join(", ")}`,
        });
      }

      this.logDebug("README update completed", { success: result.success });
    } catch (error) {
      this.logError("Failed to update README", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to update README: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}

