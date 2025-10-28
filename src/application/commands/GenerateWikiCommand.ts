import type { Command } from "./Command";
import type { EventBus } from "../../events";
import { InboundEvents } from "../../constants/Events";

interface GenerateWikiPayload {
  providerId: string;
  model?: string;
  snippet: string;
  languageId?: string;
  filePath?: string;
}

export class GenerateWikiCommand implements Command<GenerateWikiPayload> {
  constructor(private eventBus: EventBus) {}

  async execute(payload: GenerateWikiPayload): Promise<void> {
    await this.eventBus.publish(InboundEvents.generateWiki, payload);
  }
}
