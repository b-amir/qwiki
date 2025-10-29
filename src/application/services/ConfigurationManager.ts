import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import type {
  ProviderConfiguration,
  GlobalConfiguration,
  ValidationResult,
  ConfigurationSchema,
  ExportedConfiguration,
} from "../../domain/configuration";
import { EventBus } from "../../events";
import { ConfigurationError } from "../../errors";

export class ConfigurationManager {
  private configCache = new Map<string, any>();

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
  ) {}

  async initialize(): Promise<void> {
    await this.refreshCache();
  }

  async getProviderConfig(providerId: string): Promise<ProviderConfiguration | undefined> {
    const cacheKey = `provider.${providerId}`;
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }

    const config = await this.configurationRepository.get<ProviderConfiguration>(cacheKey);
    if (config) {
      this.configCache.set(cacheKey, config);
    }
    return config;
  }

  async setProviderConfig(providerId: string, config: ProviderConfiguration): Promise<void> {
    const cacheKey = `provider.${providerId}`;
    await this.configurationRepository.set(cacheKey, config);
    this.configCache.set(cacheKey, config);

    await this.eventBus.publish("providerConfigChanged", { providerId, config });
  }

  async getGlobalConfig(): Promise<GlobalConfiguration> {
    const cacheKey = "global";
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }

    const config = await this.configurationRepository.get<GlobalConfiguration>(cacheKey);
    const defaultConfig: GlobalConfiguration = {
      defaultProviderId: undefined,
      autoGenerateWiki: false,
      wikiOutputFormat: "markdown",
      maxContextLength: 10000,
      enableCaching: true,
      cacheExpirationHours: 24,
      enablePerformanceMonitoring: true,
      enableErrorReporting: true,
      logLevel: "error",
      uiTheme: "auto",
      language: "en",
      autoSave: true,
      backupEnabled: true,
      backupRetentionDays: 30,
    };

    const finalConfig = config || defaultConfig;
    this.configCache.set(cacheKey, finalConfig);
    return finalConfig;
  }

  async setGlobalConfig(config: Partial<GlobalConfiguration>): Promise<void> {
    const cacheKey = "global";
    const currentConfig = await this.getGlobalConfig();
    const updatedConfig = { ...currentConfig, ...config };

    await this.configurationRepository.set(cacheKey, updatedConfig);
    this.configCache.set(cacheKey, updatedConfig);

    await this.eventBus.publish("globalConfigChanged", { config: updatedConfig });
  }

  async validateConfiguration(config: any, schema: ConfigurationSchema): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    for (const field of schema.fields) {
      const value = config[field.name];

      if (field.required && (value === undefined || value === null)) {
        errors.push({
          field: field.name,
          code: "REQUIRED_FIELD_MISSING",
          message: `Field ${field.name} is required`,
          severity: "error",
        });
        continue;
      }

      if (value !== undefined && field.validation) {
        if (field.type === "number") {
          if (field.validation.min !== undefined && value < field.validation.min) {
            errors.push({
              field: field.name,
              code: "VALUE_TOO_SMALL",
              message: `Field ${field.name} must be at least ${field.validation.min}`,
              severity: "error",
            });
          }
          if (field.validation.max !== undefined && value > field.validation.max) {
            errors.push({
              field: field.name,
              code: "VALUE_TOO_LARGE",
              message: `Field ${field.name} must be at most ${field.validation.max}`,
              severity: "error",
            });
          }
        }

        if (field.type === "string" && field.validation.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors.push({
              field: field.name,
              code: "INVALID_FORMAT",
              message: `Field ${field.name} does not match required pattern`,
              severity: "error",
            });
          }
        }

        if (field.validation.enum && !field.validation.enum.includes(value)) {
          errors.push({
            field: field.name,
            code: "INVALID_ENUM_VALUE",
            message: `Field ${field.name} must be one of: ${field.validation.enum.join(", ")}`,
            severity: "error",
          });
        }

        if (field.validation.custom && !field.validation.custom(value)) {
          errors.push({
            field: field.name,
            code: "CUSTOM_VALIDATION_FAILED",
            message: `Field ${field.name} failed custom validation`,
            severity: "error",
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  clearCache(): void {
    this.configCache.clear();
  }

  async exportConfiguration(): Promise<ExportedConfiguration> {
    const global = await this.getGlobalConfig();
    const allConfigs = await this.configurationRepository.getAll();
    const providers: Record<string, ProviderConfiguration> = {};

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.startsWith("provider.") && value) {
        const providerId = key.replace("provider.", "");
        providers[providerId] = value as ProviderConfiguration;
      }
    }

    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      global,
      providers,
      metadata: {
        exportedBy: "qwiki",
        description: "Configuration export",
      },
    };
  }

  async importConfiguration(config: ExportedConfiguration): Promise<void> {
    await this.setGlobalConfig(config.global);

    for (const [providerId, providerConfig] of Object.entries(config.providers)) {
      await this.setProviderConfig(providerId, providerConfig);
    }

    await this.eventBus.publish("configurationImported", { config });
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.configCache.has(key)) {
      return this.configCache.get(key);
    }

    const value = await this.configurationRepository.get<T>(key);
    if (value !== undefined) {
      this.configCache.set(key, value);
    }
    return value;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.configurationRepository.set(key, value);
    this.configCache.set(key, value);
  }

  async getAll(): Promise<Record<string, any>> {
    if (this.configCache.size === 0) {
      await this.refreshCache();
    }

    const result: Record<string, any> = {};
    for (const [key, value] of this.configCache.entries()) {
      result[key] = value;
    }
    return result;
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      await this.configurationRepository.set(key, undefined as any);
      this.configCache.delete(key);
    } else {
      this.configCache.clear();
    }
  }

  async refreshCache(): Promise<void> {
    this.configCache.clear();
    const allConfigs = await this.configurationRepository.getAll();

    for (const [key, value] of Object.entries(allConfigs)) {
      this.configCache.set(key, value);
    }
  }

  async getWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key);
    return value !== undefined ? value : defaultValue;
  }
}
