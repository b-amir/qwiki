import type {
  ExportedConfiguration,
  GlobalConfiguration,
  ProviderConfigurationMap,
} from "@/domain/configuration";
import type {
  ExportOptions,
  ConfigurationExport,
} from "@/application/services/configuration/ConfigurationImportExportService";

export class ConfigurationExporter {
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

    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      format: exportOptions.format,
      encrypted: exportOptions.encryption || false,
      compressed: exportOptions.compression || false,
      data: exportData,
      metadata: {
        exportedBy: options.metadata?.exportedBy || "",
        description: options.metadata?.description || "",
        tags: options.metadata?.tags || [],
      },
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
}
