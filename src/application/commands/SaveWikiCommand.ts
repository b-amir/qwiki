import type { Command } from "./Command";
import type { WikiStorageService } from "../services/WikiStorageService";
import type { MessageBus } from "../services/MessageBus";

interface SaveWikiPayload {
  title: string;
  content: string;
  sourceFilePath?: string;
}

export class SaveWikiCommand implements Command<SaveWikiPayload> {
  constructor(
    private wikiStorageService: WikiStorageService,
    private messageBus: MessageBus,
  ) {}

  async execute(payload: SaveWikiPayload): Promise<void> {
    try {
      console.log("[QWIKI] SaveWikiCommand: Starting to save wiki", {
        title: payload.title,
        contentLength: payload.content.length,
      });
      const savedWiki = await this.wikiStorageService.saveWiki(
        payload.title,
        payload.content,
        payload.sourceFilePath,
      );
      console.log("[QWIKI] SaveWikiCommand: Wiki saved successfully", {
        id: savedWiki.id,
        filePath: savedWiki.filePath,
      });

      await this.messageBus.postMessage("wikiSaved", {
        id: savedWiki.id,
        title: savedWiki.title,
        filePath: savedWiki.filePath,
        createdAt: savedWiki.createdAt,
      });
      console.log("[QWIKI] SaveWikiCommand: Sent wikiSaved message");

      await this.messageBus.postMessage("showNotification", {
        type: "success",
        message: `Wiki "${savedWiki.title}" saved successfully`,
      });
      console.log("[QWIKI] SaveWikiCommand: Sent success notification");
    } catch (error) {
      console.error("[QWIKI] SaveWikiCommand: Failed to save wiki", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to save wiki: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
