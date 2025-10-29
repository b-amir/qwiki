import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import { ConfigurationError } from "../../errors";

export class ConfigurationManager {
  private configCache: Record<string, any> = {};

  constructor(private configurationRepository: ConfigurationRepository) {}

  async initialize(): Promise<void> {
    await this.refreshCache();
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.configCache[key] !== undefined) {
      return this.configCache[key] as T;
    }

    const value = await this.configurationRepository.get<T>(key);
    this.configCache[key] = value;
    return value;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.configurationRepository.set(key, value);
    this.configCache[key] = value;
  }

  async getAll(): Promise<Record<string, any>> {
    if (Object.keys(this.configCache).length === 0) {
      await this.refreshCache();
    }
    return { ...this.configCache };
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      await this.configurationRepository.set(key, undefined as any);
      delete this.configCache[key];
    } else {
      this.configCache = {};
    }
  }

  async refreshCache(): Promise<void> {
    this.configCache = await this.configurationRepository.getAll();
  }

  async getWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }
}
