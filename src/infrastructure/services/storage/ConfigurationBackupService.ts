import type { ConfigurationRepository } from "@/domain/repositories/ConfigurationRepository";
import type {
  ConfigurationBackup,
  ExportedConfiguration,
  ProviderConfiguration,
  GlobalConfiguration,
} from "@/domain/configuration";
import { EventBus } from "@/events";

export class ConfigurationBackupService {
  private readonly BACKUP_PREFIX = "qwiki.backup.";
  private readonly BACKUP_INDEX_KEY = "qwiki.backup.index";
  private readonly MAX_BACKUPS = 10;

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
  ) {}

  async createBackup(description?: string): Promise<ConfigurationBackup> {
    const allConfigs = await this.configurationRepository.getAll();
    const providers: Record<string, ProviderConfiguration> = {};
    let global: GlobalConfiguration = {} as GlobalConfiguration;

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.startsWith("provider.") && value) {
        const providerId = key.replace("provider.", "");
        providers[providerId] = value;
      } else if (key === "global" && value) {
        global = value as GlobalConfiguration;
      }
    }

    const configuration: ExportedConfiguration = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      global,
      providers,
      metadata: {
        exportedBy: "qwiki",
        description: description || "Manual backup",
      },
    };

    const backupId = this.generateBackupId();
    const backupKey = `${this.BACKUP_PREFIX}${backupId}`;

    const compressedConfig = await this.compressConfiguration(configuration);
    const backup: ConfigurationBackup = {
      id: backupId,
      createdAt: configuration.exportedAt,
      description,
      configuration: compressedConfig,
      size: this.calculateSize(configuration),
      compressed: true,
    };

    await this.configurationRepository.set(backupKey, backup);
    await this.updateBackupIndex(backup);
    await this.cleanupOldBackups();

    await this.eventBus.publish("backupCreated", { backupId, backup });

    return backup;
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backupKey = `${this.BACKUP_PREFIX}${backupId}`;
    const backup = await this.configurationRepository.get<ConfigurationBackup>(backupKey);

    if (!backup) {
      throw new Error(`Backup with id '${backupId}' not found`);
    }

    const configuration = await this.decompressConfiguration(backup.configuration);

    await this.configurationRepository.set("global", configuration.global);

    for (const [providerId, providerConfig] of Object.entries(configuration.providers)) {
      await this.configurationRepository.set(`provider.${providerId}`, providerConfig);
    }

    await this.eventBus.publish("backupRestored", { backupId, configuration });
  }

  async listBackups(): Promise<ConfigurationBackup[]> {
    const index = await this.getBackupIndex();
    const backups: ConfigurationBackup[] = [];

    for (const backupId of index) {
      const backupKey = `${this.BACKUP_PREFIX}${backupId}`;
      const backup = await this.configurationRepository.get<ConfigurationBackup>(backupKey);

      if (backup) {
        backups.push(backup);
      }
    }

    return backups.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async deleteBackup(backupId: string): Promise<void> {
    const backupKey = `${this.BACKUP_PREFIX}${backupId}`;
    const backup = await this.configurationRepository.get<ConfigurationBackup>(backupKey);

    if (!backup) {
      throw new Error(`Backup with id '${backupId}' not found`);
    }

    await this.configurationRepository.set(backupKey, undefined as any);
    await this.removeFromBackupIndex(backupId);

    await this.eventBus.publish("backupDeleted", { backupId });
  }

  async scheduleAutomaticBackup(interval: number): Promise<void> {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = setInterval(
      async () => {
        try {
          await this.createBackup("Automatic backup");
        } catch (error) {
          await this.eventBus.publish("automaticBackupFailed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      interval * 60 * 60 * 1000,
    ); // Convert hours to milliseconds

    await this.eventBus.publish("automaticBackupScheduled", { interval });
  }

  async stopAutomaticBackup(): Promise<void> {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = undefined;

      await this.eventBus.publish("automaticBackupStopped", {});
    }
  }

  private backupInterval?: NodeJS.Timeout;

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}-${random}`;
  }

  private async getBackupIndex(): Promise<string[]> {
    return (await this.configurationRepository.get<string[]>(this.BACKUP_INDEX_KEY)) || [];
  }

  private async updateBackupIndex(backup: ConfigurationBackup): Promise<void> {
    const index = await this.getBackupIndex();
    const updatedIndex = [backup.id, ...index.filter((id) => id !== backup.id)];
    await this.configurationRepository.set(this.BACKUP_INDEX_KEY, updatedIndex);
  }

  private async removeFromBackupIndex(backupId: string): Promise<void> {
    const index = await this.getBackupIndex();
    const updatedIndex = index.filter((id) => id !== backupId);
    await this.configurationRepository.set(this.BACKUP_INDEX_KEY, updatedIndex);
  }

  private async cleanupOldBackups(): Promise<void> {
    const index = await this.getBackupIndex();

    if (index.length <= this.MAX_BACKUPS) {
      return;
    }

    const backupsToDelete = index.slice(this.MAX_BACKUPS);

    for (const backupId of backupsToDelete) {
      const backupKey = `${this.BACKUP_PREFIX}${backupId}`;
      await this.configurationRepository.set(backupKey, undefined as any);
    }

    const updatedIndex = index.slice(0, this.MAX_BACKUPS);
    await this.configurationRepository.set(this.BACKUP_INDEX_KEY, updatedIndex);
  }

  private calculateSize(configuration: ExportedConfiguration): number {
    return JSON.stringify(configuration).length;
  }

  private async compressConfiguration(configuration: ExportedConfiguration): Promise<any> {
    try {
      const jsonString = JSON.stringify(configuration);

      if (typeof Buffer !== "undefined") {
        const compressed = Buffer.from(jsonString).toString("base64");
        return { compressed: true, data: compressed };
      }

      return configuration;
    } catch (error) {
      return configuration;
    }
  }

  private async decompressConfiguration(
    compressedConfig: ExportedConfiguration | { compressed: true; data: string },
  ): Promise<ExportedConfiguration> {
    try {
      if (
        compressedConfig &&
        typeof compressedConfig === "object" &&
        "compressed" in compressedConfig &&
        compressedConfig.compressed
      ) {
        if (typeof Buffer !== "undefined") {
          const decompressed = Buffer.from(compressedConfig.data, "base64").toString("utf8");
          return JSON.parse(decompressed);
        }
      }

      return compressedConfig as ExportedConfiguration;
    } catch (error) {
      throw new Error(`Failed to decompress configuration: ${error}`);
    }
  }
}
