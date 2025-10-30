import type { Command } from "./Command";
import type { MessageBus } from "../services/MessageBus";
import * as vscode from "vscode";

interface OpenExternalPayload {
  url: string;
}

export class OpenExternalCommand implements Command<OpenExternalPayload> {
  constructor(private messageBus: MessageBus) {}

  async execute(payload: OpenExternalPayload): Promise<void> {
    try {
      console.log("[QWIKI] OpenExternalCommand: Opening external URL", payload.url);

      if (!payload.url) {
        throw new Error("URL is required");
      }

      await vscode.env.openExternal(vscode.Uri.parse(payload.url));
      console.log("[QWIKI] OpenExternalCommand: External URL opened successfully");
    } catch (error) {
      console.error("[QWIKI] OpenExternalCommand: Failed to open external URL", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to open URL: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
