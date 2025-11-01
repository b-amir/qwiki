import type { Command } from "./Command";
import type { MessageBus } from "../services/MessageBus";
import * as vscode from "vscode";
import { LoggingService } from "../../infrastructure/services/LoggingService";

interface OpenExternalPayload {
  url: string;
}

export class OpenExternalCommand implements Command<OpenExternalPayload> {
  constructor(
    private messageBus: MessageBus,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {}

  private readonly serviceName = "OpenExternalCommand";

  private logDebug(message: string, data?: unknown): void {
    this.loggingService.debug(this.serviceName, message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.loggingService.error(this.serviceName, message, data);
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
