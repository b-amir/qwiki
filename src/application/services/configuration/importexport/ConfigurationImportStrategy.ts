import type { GlobalConfiguration, ProviderConfigurationMap } from "@/domain/configuration";
import type { ImportOptions } from "@/application/services/configuration/ConfigurationImportExportService";

export class ConfigurationImportStrategy {
  async importGlobalConfiguration(
    global: Partial<GlobalConfiguration>,
    existing: GlobalConfiguration,
    options: ImportOptions,
  ): Promise<GlobalConfiguration> {
    switch (options.mergeStrategy) {
      case "replace":
        return global as GlobalConfiguration;
      case "merge":
        return { ...existing, ...global };
      case "skip-existing":
        const filtered = Object.entries(global).reduce((acc, [key, value]) => {
          if (existing[key as keyof GlobalConfiguration] === undefined) {
            (acc as any)[key] = value;
          }
          return acc;
        }, {} as Partial<GlobalConfiguration>);
        return { ...existing, ...filtered };
      default:
        return existing;
    }
  }

  async importProviderConfigurations(
    providers: ProviderConfigurationMap,
    existing: ProviderConfigurationMap,
    options: ImportOptions,
  ): Promise<ProviderConfigurationMap> {
    const result: ProviderConfigurationMap = { ...existing };

    for (const [providerId, config] of Object.entries(providers)) {
      const existingConfig = existing[providerId];

      switch (options.mergeStrategy) {
        case "replace":
          result[providerId] = config;
          break;
        case "merge":
          result[providerId] = existingConfig ? { ...existingConfig, ...config } : config;
          break;
        case "skip-existing":
          if (!existingConfig) {
            result[providerId] = config;
          }
          break;
      }
    }

    return result;
  }

  async importTemplates(
    templates: Record<string, any>,
    options: ImportOptions,
  ): Promise<Record<string, any>> {
    return templates;
  }
}
