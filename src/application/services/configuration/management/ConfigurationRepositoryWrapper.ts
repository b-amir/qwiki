import type { ConfigurationRepository } from "@/domain/repositories/ConfigurationRepository";

export class ConfigurationRepositoryWrapper {
  constructor(
    private configurationRepository: ConfigurationRepository,
    private cacheManager: {
      has: (key: string) => boolean;
      get: <T>(key: string) => T | undefined;
      set: <T>(key: string, value: T) => void;
      delete: (key: string) => void;
      clear: () => void;
      refreshCache: (getAllConfigs: () => Promise<Record<string, any>>) => Promise<void>;
    },
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    if (this.cacheManager.has(key)) {
      return this.cacheManager.get(key);
    }

    const value = await this.configurationRepository.get<T>(key);
    if (value !== undefined) {
      this.cacheManager.set(key, value);
    }
    return value;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.configurationRepository.set(key, value);
    this.cacheManager.set(key, value);
  }

  async getAll(): Promise<Record<string, any>> {
    if (!this.cacheManager.has("_cacheInitialized")) {
      await this.refreshCache();
    }

    const repositoryConfigs = await this.configurationRepository.getAll();
    const result: Record<string, any> = { ...repositoryConfigs };

    const cachedProviderId = this.cacheManager.get("cachedProviderId");
    if (cachedProviderId) {
      result["cachedProviderId"] = cachedProviderId;
    }

    return result;
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      await this.configurationRepository.set(key, undefined as any);
      this.cacheManager.delete(key);
    } else {
      this.cacheManager.clear();
    }
  }

  async getWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }

  async refreshCache(): Promise<void> {
    await this.cacheManager.refreshCache(() => this.configurationRepository.getAll());
    this.cacheManager.set("_cacheInitialized", true);
  }
}
