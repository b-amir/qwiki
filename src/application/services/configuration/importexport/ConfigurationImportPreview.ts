import type {
  GlobalConfiguration,
  ProviderConfigurationMap,
  ExportedConfiguration,
} from "@/domain/configuration";
import type {
  ImportOptions,
  ImportPreview,
  ImportConflict,
} from "../ConfigurationImportExportService";

export class ConfigurationImportPreview {
  async previewImport(
    data: ExportedConfiguration,
    existingGlobal: GlobalConfiguration,
    existingProviders: ProviderConfigurationMap,
    options: ImportOptions,
  ): Promise<ImportPreview> {
    const conflicts: ImportConflict[] = [];
    const warnings: string[] = [];

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
            if (existingConfig && (existingConfig as Record<string, any>)[key] !== undefined) {
              conflicts.push({
                type: "provider",
                id: providerId,
                field: key,
                existingValue: (existingConfig as Record<string, any>)[key],
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
}
