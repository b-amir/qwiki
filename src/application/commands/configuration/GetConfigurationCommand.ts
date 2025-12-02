import { Command } from "@/application/commands/Command";
import type { ConfigurationManagerService } from "@/application/services";

export class GetConfigurationCommand implements Command {
  constructor(private configManager: ConfigurationManagerService) {}

  async execute(payload?: Record<string, unknown>): Promise<{ all: Record<string, unknown> }> {
    const allConfig = await this.configManager.getAll();
    return { all: allConfig };
  }
}
