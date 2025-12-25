import { workspace } from "vscode";
import type { ConfigurationRepository } from "@/domain/repositories/ConfigurationRepository";
import { Extension } from "@/constants/Extension";

export class VSCodeConfigurationRepository implements ConfigurationRepository {
  async get<T>(key: string): Promise<T | undefined> {
    return workspace.getConfiguration(Extension.configurationSection).get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    const config = workspace.getConfiguration(Extension.configurationSection);
    await config.update(key, value, true);
  }

  async delete(key: string): Promise<void> {
    const config = workspace.getConfiguration(Extension.configurationSection);
    await config.update(key, undefined, true);
  }

  async getAll(): Promise<Record<string, any>> {
    const config = workspace.getConfiguration(Extension.configurationSection);
    const result: Record<string, any> = {};

    const knownKeys = ["global", "migration.version", "migration.globalBackup", "cachedProviderId"];

    for (const key of knownKeys) {
      const value = config.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }

    const knownProviderIds = ["google-ai-studio", "zai", "openrouter", "cohere", "huggingface"];

    for (const providerId of knownProviderIds) {
      const providerConfig = config.get<Record<string, any>>(`provider.${providerId}`);
      if (providerConfig) {
        result[`provider.${providerId}`] = providerConfig;
      }
    }

    return result;
  }
}
