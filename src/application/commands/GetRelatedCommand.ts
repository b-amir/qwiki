import type { Command } from "./Command";
import type { SelectionService } from "../services/SelectionService";
import type { ProjectContextService } from "../services/ProjectContextService";
import type { MessageBus } from "../services/MessageBus";
import { OutboundEvents } from "../../constants/Events";

export class GetRelatedCommand implements Command<void> {
  constructor(
    private selectionService: SelectionService,
    private projectContextService: ProjectContextService,
    private messageBus: MessageBus,
  ) {}

  async execute(): Promise<void> {
    const payload =
      this.selectionService.getCurrentSelection() ?? this.selectionService.getLastSelection();
    if (payload) {
      const project = await this.projectContextService.buildContext(
        payload.text,
        payload.filePath,
        payload.languageId,
      );
      this.messageBus.postSuccess(OutboundEvents.related, project);
    }
  }
}
