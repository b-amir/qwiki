import { Command } from "./Command";
import { ConfigurationError } from "../../errors";
import type { ConfigurationManager } from "../services";

export class UpdateConfigurationCommand implements Command {
  constructor(private configManager: ConfigurationManager) {}

  async execute(payload: { key: string; value: any }): Promise<any> {
    const { key, value } = payload;

    if (!this.configManager.isKeyValid(key)) {
      throw new ConfigurationError(
        "invalidConfiguration",
        `Unknown configuration key: ${key}. Valid keys: ${this.configManager.getConfigurationKeys().join(", ")}`,
      );
    }

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
