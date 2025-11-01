import { Command } from "./Command";
import { ConfigurationError } from "../../errors";
import type { ConfigurationManagerService } from "../services";

export class UpdateConfigurationCommand implements Command {
  constructor(private configManager: ConfigurationManagerService) {}

  async execute(payload: { key: string; value: any }): Promise<any> {
    const { key, value } = payload;

    try {
      await this.configManager.set(key, value);
      return { success: true, key, value };
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(
        "invalidConfiguration",
        `Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
