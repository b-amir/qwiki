import { Command } from "./Command";
import type { ConfigurationManager } from "../services";

export class GetConfigurationCommand implements Command {
  constructor(private configManager: ConfigurationManager) {}

  async execute(payload?: any): Promise<any> {
    const allConfig = await this.configManager.getAll();
    const zaiBaseUrl = this.configManager.getZaiBaseUrl();
    const googleEndpoint = this.configManager.getGoogleAIEndpoint();
    
    return {
      all: allConfig,
      zaiBaseUrl,
      googleEndpoint,
      defaults: this.configManager.getConfigurationDefaults(),
      keys: this.configManager.getConfigurationKeys()
    };
  }
}