import type { Command } from "./Command";
import { LoggingService } from "../../infrastructure/services/LoggingService";

export class ToggleOutputChannelCommand implements Command<void> {
  constructor(private loggingService: LoggingService) {}

  async execute(): Promise<void> {
    this.loggingService.toggleOutputChannel();
  }
}
