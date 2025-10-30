import type {
  ExportedConfiguration,
  ValidationResult,
  GlobalConfiguration,
  ProviderConfigurationMap,
  ConfigurationBackup,
} from "../../domain/configuration";
import type {
  ConfigurationValidationEngine,
  ValidationContext,
} from "./ConfigurationValidationEngine";

export interface ExportOptions {
  includeApiKeys?: boolean;
  includeSecrets?: boolean;
  format?: "json" | "yaml";
  compression?: boolean;
  encryption?: boolean;
  password?: string;
  metadata?: {
    exportedBy?: string;
    description?: string;
    tags?: string[];
  };
}

export interface ImportOptions {
  mergeStrategy?: "replace" | "merge" | "skip-existing";
  validateBeforeImport?: boolean;
  createBackup?: boolean;
  preserveExistingApiKeys?: boolean;
  password?: string;
}

export interface ConfigurationExport {
  version: string;
  exportedAt: string;
  format: string;
  encrypted: boolean;
  compressed: boolean;
  data: any;
  metadata: {
    exportedBy?: string;
    description?: string;
    tags?: string[];
  };
}

export interface ImportPreview {
  canImport: boolean;
  conflicts: ImportConflict[];
  warnings: string[];
  summary: {
    globalSettings: number;
    providers: number;
    templates: number;
  };
}

export interface ImportConflict {
  type: "global" | "provider" | "template";
  id: string;
  field: string;
  existingValue: any;
  incomingValue: any;
  resolution?: "replace" | "keep" | "merge";
}

export class ConfigurationImportExportService {
  constructor(private validationEngine: ConfigurationValidationEngine) {}

  async exportConfiguration(
    global: GlobalConfiguration,
    providers: ProviderConfigurationMap,
    options: ExportOptions = {},
  ): Promise<ConfigurationExport> {
    const exportOptions = {
      includeApiKeys: false,
      includeSecrets: false,
      format: "json" as const,
      compression: false,
      encryption: false,
      ...options,
    };

    const exportData: ExportedConfiguration = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      global: this.sanitizeConfiguration(global, exportOptions),
      providers: this.sanitizeProviders(providers, exportOptions),
      metadata: {
        exportedBy: options.metadata?.exportedBy || "",
        description: options.metadata?.description || "",
      },
    };

    let data = exportData;

    if (exportOptions.compression) {
      data = await this.compressData(data);
    }

    if (exportOptions.encryption && exportOptions.password) {
      data = await this.encryptData(data, exportOptions.password);
    }

    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      format: exportOptions.format,
      encrypted: exportOptions.encryption || false,
      compressed: exportOptions.compression || false,
      data,
      metadata: {
        exportedBy: options.metadata?.exportedBy || "",
        description: options.metadata?.description || "",
        tags: options.metadata?.tags || [],
      },
    };
  }

  async importConfiguration(
    exportData: ConfigurationExport,
    options: ImportOptions = {},
  ): Promise<void> {
    const importOptions = {
      mergeStrategy: "merge" as const,
      validateBeforeImport: true,
      createBackup: true,
      preserveExistingApiKeys: true,
      ...options,
    };

    let data = exportData.data;

    if (exportData.encrypted && importOptions.password) {
      data = await this.decryptData(data, importOptions.password);
    }

    if (exportData.compressed) {
      data = await this.decompressData(data);
    }

    if (importOptions.validateBeforeImport) {
      const validationResult = await this.validateImportData(data);
      if (!validationResult.isValid) {
        throw new Error(
          `Import validation failed: ${validationResult.errors.map((e) => e.message).join(", ")}`,
        );
      }
    }

    if (importOptions.createBackup) {
      await this.createBackup();
    }

    const preview = await this.previewImport(data, importOptions);
    if (!preview.canImport) {
      throw new Error("Import preview detected issues that prevent import");
    }

    await this.applyImport(data, importOptions);
  }

  async validateImportData(data: any): Promise<ValidationResult> {
    const context: ValidationContext = {
      configuration: data,
      operation: "create",
      timestamp: new Date(),
    };

    const schema = this.createImportSchema();
    return this.validationEngine.validateConfiguration(data, schema, context);
  }

  async previewImport(data: any, options: ImportOptions): Promise<ImportPreview> {
    const conflicts: ImportConflict[] = [];
    const warnings: string[] = [];

    const existingGlobal = await this.getCurrentGlobalConfiguration();
    const existingProviders = await this.getCurrentProviderConfigurations();

    if (data.global) {
      for (const [key, value] of Object.entries(data.global)) {
        if (existingGlobal[key as keyof GlobalConfiguration] !== undefined) {
          conflicts.push({
            type: "global",
            id: "global",
            field: key,
            existingValue: existingGlobal[key as keyof GlobalConfiguration],
            incomingValue: value,
          });
        }
      }
    }

    if (data.providers) {
      for (const [providerId, providerConfig] of Object.entries(data.providers)) {
        if (existingProviders[providerId]) {
          for (const [key, value] of Object.entries(providerConfig as Record<string, any>)) {
            const existingConfig = existingProviders[providerId];
            if (existingConfig && (existingConfig as any)[key] !== undefined) {
              conflicts.push({
                type: "provider",
                id: providerId,
                field: key,
                existingValue: (existingConfig as any)[key],
                incomingValue: value,
              });
            }
          }
        }
      }
    }

    const canImport = conflicts.length === 0 || options.mergeStrategy !== "skip-existing";
    const summary = {
      globalSettings: data.global ? Object.keys(data.global).length : 0,
      providers: data.providers ? Object.keys(data.providers).length : 0,
      templates: data.templates ? Object.keys(data.templates).length : 0,
    };

    return {
      canImport,
      conflicts,
      warnings,
      summary,
    };
  }

  private sanitizeConfiguration(
    config: GlobalConfiguration,
    options: ExportOptions,
  ): GlobalConfiguration {
    const sanitized = { ...config };

    if (!options.includeSecrets) {
      const sanitizedAny = sanitized as any;
      delete sanitizedAny.backupEnabled;
      delete sanitizedAny.backupRetentionDays;
      return sanitizedAny as GlobalConfiguration;
    }

    return sanitized;
  }

  private sanitizeProviders(
    providers: ProviderConfigurationMap,
    options: ExportOptions,
  ): ProviderConfigurationMap {
    const sanitized: ProviderConfigurationMap = {};

    for (const [providerId, config] of Object.entries(providers)) {
      sanitized[providerId] = { ...config };

      if (!options.includeApiKeys) {
        delete sanitized[providerId].apiKey;
      }

      if (!options.includeSecrets) {
        delete sanitized[providerId].customFields;
      }
    }

    return sanitized;
  }

  private async compressData(data: any): Promise<any> {
    return data;
  }

  private async decompressData(data: any): Promise<any> {
    return data;
  }

  private async encryptData(data: any, password: string): Promise<any> {
    return data;
  }

  private async decryptData(data: any, password: string): Promise<any> {
    return data;
  }

  private async createBackup(): Promise<void> {
    const global = await this.getCurrentGlobalConfiguration();
    const providers = await this.getCurrentProviderConfigurations();

    const backup: ConfigurationBackup = {
      id: `backup-${Date.now()}`,
      createdAt: new Date().toISOString(),
      description: "Automatic backup before import",
      configuration: {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        global,
        providers,
        metadata: {
          exportedBy: "system",
          description: "Automatic backup",
        },
      },
      size: JSON.stringify({ global, providers }).length,
      compressed: false,
    };

    await this.saveBackup(backup);
  }

  private async applyImport(data: any, options: ImportOptions): Promise<void> {
    if (data.global) {
      await this.importGlobalConfiguration(data.global, options);
    }

    if (data.providers) {
      await this.importProviderConfigurations(data.providers, options);
    }

    if (data.templates) {
      await this.importTemplates(data.templates, options);
    }
  }

  private async importGlobalConfiguration(
    global: Partial<GlobalConfiguration>,
    options: ImportOptions,
  ): Promise<void> {
    const existing = await this.getCurrentGlobalConfiguration();

    switch (options.mergeStrategy) {
      case "replace":
        await this.saveGlobalConfiguration(global as GlobalConfiguration);
        break;
      case "merge":
        const merged1 = { ...existing, ...global };
        await this.saveGlobalConfiguration(merged1);
        break;
      case "skip-existing":
        const filtered = Object.entries(global).reduce((acc, [key, value]) => {
          if (existing[key as keyof GlobalConfiguration] === undefined) {
            (acc as any)[key] = value;
          }
          return acc;
        }, {} as Partial<GlobalConfiguration>);
        const merged2 = { ...existing, ...filtered };
        await this.saveGlobalConfiguration(merged2);
        break;
    }
  }

  private async importProviderConfigurations(
    providers: ProviderConfigurationMap,
    options: ImportOptions,
  ): Promise<void> {
    const existing = await this.getCurrentProviderConfigurations();

    for (const [providerId, config] of Object.entries(providers)) {
      const existingConfig = existing[providerId];

      switch (options.mergeStrategy) {
        case "replace":
          await this.saveProviderConfiguration(providerId, config);
          break;
        case "merge":
          const merged3 = existingConfig ? { ...existingConfig, ...config } : config;
          await this.saveProviderConfiguration(providerId, merged3);
          break;
        case "skip-existing":
          if (!existingConfig) {
            await this.saveProviderConfiguration(providerId, config);
          }
          break;
      }
    }
  }

  private async importTemplates(templates: any, options: ImportOptions): Promise<void> {
    for (const [templateId, template] of Object.entries(templates)) {
      await this.saveTemplate(templateId, template);
    }
  }

  private createImportSchema(): any {
    return {
      version: "1.0.0",
      fields: [
        {
          name: "global",
          type: "object",
          required: false,
          description: "Global configuration settings",
        },
        {
          name: "providers",
          type: "object",
          required: false,
          description: "Provider configuration settings",
        },
        {
          name: "templates",
          type: "object",
          required: false,
          description: "Configuration templates",
        },
      ],
    };
  }

  private async getCurrentGlobalConfiguration(): Promise<GlobalConfiguration> {
    return {} as GlobalConfiguration;
  }

  private async getCurrentProviderConfigurations(): Promise<ProviderConfigurationMap> {
    return {} as ProviderConfigurationMap;
  }

  private async saveGlobalConfiguration(config: GlobalConfiguration): Promise<void> {}

  private async saveProviderConfiguration(providerId: string, config: any): Promise<void> {}

  private async saveBackup(backup: ConfigurationBackup): Promise<void> {}

  private async saveTemplate(templateId: string, template: any): Promise<void> {}
}
