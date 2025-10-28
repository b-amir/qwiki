import { workspace } from "vscode";
import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import { Extension } from "../../constants/Extension";

export class VSCodeConfigurationRepository implements ConfigurationRepository {
  async get<T>(key: string): Promise<T | undefined> {
    return workspace.getConfiguration(Extension.configurationSection).get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    const config = workspace.getConfiguration(Extension.configurationSection);
    await config.update(key, value, true);
  }

  async getAll(): Promise<Record<string, any>> {
    const config = workspace.getConfiguration(Extension.configurationSection);
    return config as any;
  }
}
