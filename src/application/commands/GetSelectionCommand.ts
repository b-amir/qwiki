import type { Command } from "./Command";
import type { SelectionService } from "../services/SelectionService";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";

export class GetSelectionCommand implements Command<void> {
  constructor(
    private selectionService: SelectionService,
    private messageBus: MessageBus,
  ) {}

  async execute(): Promise<void> {
    const payload = this.selectionService.getCurrentSelection() ??
      this.selectionService.getLastSelection() ?? { text: "" };

    this.messageBus.postSuccess(OutboundEvents.selection, payload);
  }
}
