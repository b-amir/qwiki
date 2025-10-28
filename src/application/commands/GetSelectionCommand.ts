import type { Command } from "./Command";
import type { EventBus } from "../../events";
import { InboundEvents } from "../../constants/Events";

export class GetSelectionCommand implements Command<void> {
  constructor(private eventBus: EventBus) {}

  async execute(): Promise<void> {
    this.eventBus.publish(InboundEvents.getSelection, { allowFallback: true });
  }
}
