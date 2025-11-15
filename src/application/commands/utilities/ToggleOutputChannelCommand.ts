import type { Command } from "@/application/commands/Command";
import { LoggingService } from "@/infrastructure/services";

export class ToggleOutputChannelCommand implements Command<void> {
  constructor(private loggingService: LoggingService) {}

  async execute(): Promise<void> {
    this.loggingService.toggleOutputChannel();
  }
}
