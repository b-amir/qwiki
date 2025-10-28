import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import { ConfigurationError } from "../../errors";
import { ConfigurationKeys, ConfigurationDefaults } from "../../constants";
import { ConfigurationValidator } from "./ConfigurationValidator";
import { ConfigurationMigration } from "./ConfigurationMigration";
import { ConfigurationSchema, ConfigurationValidationResult } from "./ConfigurationSchema";

export class ConfigurationManager {
  private validator: ConfigurationValidator;
  private migration: ConfigurationMigration;
  private configCache: Record<string, any> = {};

  constructor(private configurationRepository: ConfigurationRepository) {
    this.validator = new ConfigurationValidator(configurationRepository);
    this.migration = new ConfigurationMigration(configurationRepository);
  }

  async initialize(): Promise<void> {
    await this.migration.migrate();
    await this.validator.validateAndFix();
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
    const validationResult = await this.validator.validateKey(key);
    
    if (!validationResult.isValid) {
      throw new ConfigurationError(
        "invalidConfiguration",
        `Invalid configuration value for '${key}': ${validationResult.errors.map(e => e.message).join(", ")}`
      );
    }

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
      const defaultValue = ConfigurationDefaults[key as keyof typeof ConfigurationDefaults];
      if (defaultValue !== undefined) {
        await this.set(key, defaultValue);
      } else {
        await this.configurationRepository.set(key, undefined);
        delete this.configCache[key];
      }
    } else {
      for (const [configKey, defaultValue] of Object.entries(ConfigurationDefaults)) {
        await this.set(configKey, defaultValue);
      }
    }
  }

  async validate(): Promise<ConfigurationValidationResult> {
    return await this.validator.validateConfiguration();
  }

  async needsMigration(): Promise<boolean> {
    return await this.migration.needsMigration();
  }

  async getMigrationHistory() {
    return this.migration.getMigrationHistory();
  }

  async refreshCache(): Promise<void> {
    this.configCache = await this.configurationRepository.getAll();
  }

  async getWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }

  getZaiBaseUrl(): string {
    return this.configCache[ConfigurationKeys.zaiBaseUrl] ?? ConfigurationDefaults[ConfigurationKeys.zaiBaseUrl];
  }

  getGoogleAIEndpoint(): "openai-compatible" | "native" {
    return this.configCache[ConfigurationKeys.googleAIEndpoint] ?? ConfigurationDefaults[ConfigurationKeys.googleAIEndpoint];
  }

  async setZaiBaseUrl(url: string): Promise<void> {
    await this.set(ConfigurationKeys.zaiBaseUrl, url);
  }

  async setGoogleAIEndpoint(endpoint: "openai-compatible" | "native"): Promise<void> {
    await this.set(ConfigurationKeys.googleAIEndpoint, endpoint);
  }

  isKeyValid(key: string): boolean {
    return Object.values(ConfigurationKeys).includes(key as any);
  }

  getConfigurationKeys(): readonly string[] {
    return Object.values(ConfigurationKeys);
  }

  getConfigurationDefaults(): Readonly<typeof ConfigurationDefaults> {
    return ConfigurationDefaults;
  }
}