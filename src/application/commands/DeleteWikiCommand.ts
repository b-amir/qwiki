import type { Command } from "./Command";
import type { WikiStorageService } from "../services/WikiStorageService";
import type { MessageBus } from "../services/MessageBus";

interface DeleteWikiPayload {
  wikiId: string;
}

export class DeleteWikiCommand implements Command<DeleteWikiPayload> {
  constructor(
    private wikiStorageService: WikiStorageService,
    private messageBus: MessageBus,
  ) {}

  async execute(payload: DeleteWikiPayload): Promise<void> {
    try {
      console.log("[QWIKI] DeleteWikiCommand: Starting to delete wiki", payload.wikiId);
      await this.wikiStorageService.deleteWiki(payload.wikiId);
      console.log("[QWIKI] DeleteWikiCommand: Wiki deleted successfully");

      await this.messageBus.postMessage("wikiDeleted", {
        wikiId: payload.wikiId,
      });
      console.log("[QWIKI] DeleteWikiCommand: Sent wikiDeleted message");

      await this.messageBus.postMessage("showNotification", {
        type: "info",
        message: "Wiki deleted successfully",
      });
      console.log("[QWIKI] DeleteWikiCommand: Sent success notification");
    } catch (error) {
      console.error("[QWIKI] DeleteWikiCommand: Failed to delete wiki", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to delete wiki: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
