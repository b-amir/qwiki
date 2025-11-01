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
import type {
  ConfigurationValidationEngineService,
  ValidationContext,
} from "./ConfigurationValidationEngineService";
import type { ConfigurationTemplateService } from "./ConfigurationTemplateService";
import type {
  ConfigurationImportExportService,
  ExportOptions,
  ImportOptions,
} from "./ConfigurationImportExportService";

export class ConfigurationManagerService {
  private configCache = new Map<string, any>();

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
    private validationEngine: ConfigurationValidationEngineService,
    private templateService: ConfigurationTemplateService,
    private importExportService: ConfigurationImportExportService,
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

  private validateField(value: any, field: any, errors: any[], warnings: any[]): void {
    if (field.type === "number" && typeof value !== "number") {
      errors.push({
        field: field.name,
        code: "INVALID_TYPE",
        message: `Field ${field.name} must be a number`,
        severity: "error",
      });
      return;
    }

    if (field.type === "string" && typeof value !== "string") {
      errors.push({
        field: field.name,
        code: "INVALID_TYPE",
        message: `Field ${field.name} must be a string`,
        severity: "error",
      });
      return;
    }

    if (field.type === "boolean" && typeof value !== "boolean") {
      errors.push({
        field: field.name,
        code: "INVALID_TYPE",
        message: `Field ${field.name} must be a boolean`,
        severity: "error",
      });
      return;
    }

    if (field.validation) {
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

      if (field.validation.pattern && typeof value === "string") {
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

  clearCache(): void {
    this.configCache.clear();
  }

  async exportConfigurationWithImportExportService(
    options: ExportOptions = {},
  ): Promise<ExportedConfiguration> {
    const global = await this.getGlobalConfig();
    const allConfigs = await this.configurationRepository.getAll();
    const providers: Record<string, ProviderConfiguration> = {};

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.startsWith("provider.") && value) {
        const providerId = key.replace("provider.", "");
        providers[providerId] = value as ProviderConfiguration;
      }
    }

    const exportResult = await this.importExportService.exportConfiguration(
      global,
      providers,
      options,
    );
    return {
      version: exportResult.version,
      exportedAt: exportResult.exportedAt,
      global: exportResult.data.global,
      providers: exportResult.data.providers,
      metadata: {
        exportedBy: exportResult.metadata.exportedBy || "",
        description: exportResult.metadata.description || "",
      },
    };
  }

  async importConfigurationWithImportExportService(
    config: any,
    options: ImportOptions = {},
  ): Promise<void> {
    await this.importExportService.importConfiguration(config, options);
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

  async applyTemplate(templateId: string, variables: Record<string, any>): Promise<void> {
    await this.templateService.applyTemplate(templateId, variables);
  }

  private createProviderSchema(providerId: string): ConfigurationSchema {
    return {
      version: "1.0.0",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Provider identifier",
        },
        {
          name: "name",
          type: "string",
          required: true,
          description: "Provider display name",
        },
        {
          name: "enabled",
          type: "boolean",
          required: true,
          description: "Whether the provider is enabled",
        },
        {
          name: "apiKey",
          type: "string",
          required: false,
          description: "API key for authentication",
        },
        {
          name: "model",
          type: "string",
          required: false,
          description: "Default model to use",
        },
        {
          name: "temperature",
          type: "number",
          required: false,
          validation: { min: 0, max: 2 },
          description: "Temperature for generation",
        },
        {
          name: "maxTokens",
          type: "number",
          required: false,
          validation: { min: 1, max: 32000 },
          description: "Maximum tokens to generate",
        },
      ],
    };
  }
}
