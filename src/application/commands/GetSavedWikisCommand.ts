import type { Command } from "./Command";
import type { WikiStorageService } from "../services/WikiStorageService";
import type { MessageBus } from "../services/MessageBus";

interface GetSavedWikisPayload {}

export class GetSavedWikisCommand implements Command<GetSavedWikisPayload> {
  constructor(
    private wikiStorageService: WikiStorageService,
    private messageBus: MessageBus,
  ) {}

  async execute(payload: GetSavedWikisPayload): Promise<void> {
    try {
      console.log("[QWIKI] GetSavedWikisCommand: Starting to get saved wikis");
      const wikis = await this.wikiStorageService.getAllSavedWikis();
      console.log("[QWIKI] GetSavedWikisCommand: Retrieved wikis", wikis.length, "wikis");

      await this.messageBus.postMessage("savedWikisLoaded", { wikis });
      console.log("[QWIKI] GetSavedWikisCommand: sent savedWikisLoaded message");
    } catch (error) {
      console.error("[QWIKI] GetSavedWikisCommand: Failed to load saved wikis", error);
      await this.messageBus.postMessage("showNotification", {
        type: "error",
        message: `Failed to load saved wikis: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      throw error;
    }
  }
}
