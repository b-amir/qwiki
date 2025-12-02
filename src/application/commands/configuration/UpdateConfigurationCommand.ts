import { Command } from "@/application/commands/Command";
import { ConfigurationError } from "@/errors";
import type { ConfigurationManagerService } from "@/application/services";

export class UpdateConfigurationCommand implements Command {
  constructor(private configManager: ConfigurationManagerService) {}

  async execute(payload: { key: string; value: unknown }): Promise<{ success: boolean }> {
    const { key, value } = payload;

    try {
      await this.configManager.set(key, value);
      return { success: true };
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
