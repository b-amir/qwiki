import { Command } from "./Command";
import type { ConfigurationManager } from "../services";

export class GetConfigurationCommand implements Command {
  constructor(private configManager: ConfigurationManager) {}

  async execute(payload?: any): Promise<any> {
    const allConfig = await this.configManager.getAll();
    return { all: allConfig };
  }
}
