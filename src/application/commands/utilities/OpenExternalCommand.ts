import type { Command } from "@/application/commands/Command";
import type { MessageBusService } from "@/application/services/core/MessageBusService";
import * as vscode from "vscode";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

interface OpenExternalPayload {
  url: string;
}

export class OpenExternalCommand implements Command<OpenExternalPayload> {
  private logger: Logger;

  constructor(
    private messageBus: MessageBusService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("OpenExternalCommand");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  async execute(payload: OpenExternalPayload): Promise<void> {
    try {
      this.logDebug("Opening external URL", payload.url);

      if (!payload.url) {
        throw new Error("URL is required");
      }

      await vscode.env.openExternal(vscode.Uri.parse(payload.url));
      this.logDebug("External URL opened successfully");
    } catch (error) {
      this.logError("Failed to open external URL", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to open URL: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
