import { Command } from "./Command";
import type { ConfigurationManagerService } from "../services";

export class GetConfigurationCommand implements Command {
  constructor(private configManager: ConfigurationManagerService) {}

  async execute(payload?: any): Promise<any> {
    const allConfig = await this.configManager.getAll();
    return { all: allConfig };
  }
}
