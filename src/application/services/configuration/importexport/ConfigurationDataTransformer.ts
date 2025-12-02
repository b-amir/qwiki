import type { ExportedConfiguration } from "@/domain/configuration";

export class ConfigurationDataTransformer {
  async compressData(data: ExportedConfiguration): Promise<ExportedConfiguration> {
    return data;
  }

  async decompressData(data: ExportedConfiguration): Promise<ExportedConfiguration> {
    return data;
  }

  async encryptData(data: ExportedConfiguration, password: string): Promise<ExportedConfiguration> {
    return data;
  }

  async decryptData(data: ExportedConfiguration, password: string): Promise<ExportedConfiguration> {
    return data;
  }
}
