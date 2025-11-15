import type { MigrationStep, ExportedConfiguration } from "@/domain/configuration";
import type { ConfigurationRepository } from "@/domain/repositories/ConfigurationRepository";
import { EventBus } from "@/events";

export class ConfigurationMigrationService {
  private migrationSteps: MigrationStep[] = [];
  private readonly MIGRATION_VERSION_KEY = "migration.version";
  private readonly BACKUP_PREFIX = "migration.backup.";
  private readonly GLOBAL_BACKUP_KEY = "migration.globalBackup";

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
  ) {
    this.initializeMigrationSteps();
  }

  addMigrationStep(step: MigrationStep): void {
    this.migrationSteps.push(step);
    this.migrationSteps.sort((a, b) => this.compareVersions(a.version, b.version));
  }

  async getCurrentVersion(): Promise<string> {
    return (await this.configurationRepository.get<string>(this.MIGRATION_VERSION_KEY)) || "1.0.0";
  }

  async migrateToVersion(targetVersion: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    if (this.compareVersions(currentVersion, targetVersion) >= 0) {
      return;
    }

    await this.createBackup(currentVersion);

    const applicableMigrations = this.migrationSteps.filter(
      (step) =>
        this.compareVersions(step.version, currentVersion) > 0 &&
        this.compareVersions(step.version, targetVersion) <= 0,
    );

    let config = await this.getAllConfiguration();

    for (const migration of applicableMigrations) {
      try {
        await this.eventBus.publish("migrationStarted", {
          fromVersion: currentVersion,
          toVersion: migration.version,
          description: migration.description,
        });

        config = await migration.migrate(config);

        await this.eventBus.publish("migrationCompleted", {
          version: migration.version,
          description: migration.description,
        });
      } catch (error) {
        await this.eventBus.publish("migrationFailed", {
          version: migration.version,
          error: error instanceof Error ? error.message : String(error),
        });

        await this.rollbackToVersion(currentVersion);
        throw new Error(`Migration to version ${migration.version} failed: ${error}`);
      }
    }

    await this.saveConfiguration(config);
    await this.configurationRepository.set(this.MIGRATION_VERSION_KEY, targetVersion);

    await this.eventBus.publish("migrationSequenceCompleted", {
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationsApplied: applicableMigrations.length,
    });
  }

  async needsMigration(): Promise<boolean> {
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = this.getLatestVersion();
    return this.compareVersions(latestVersion, currentVersion) > 0;
  }

  async rollbackToVersion(targetVersion: string): Promise<void> {
    const currentVersion = await this.getCurrentVersion();

    if (this.compareVersions(currentVersion, targetVersion) <= 0) {
      return;
    }

    const globalBackup = await this.configurationRepository.get<
      Record<string, ExportedConfiguration>
    >(this.GLOBAL_BACKUP_KEY);
    const backup = globalBackup?.[targetVersion];

    if (!backup) {
      throw new Error(`No backup found for version ${targetVersion}`);
    }

    await this.importConfiguration(backup);
    await this.configurationRepository.set(this.MIGRATION_VERSION_KEY, targetVersion);

    await this.eventBus.publish("rollbackCompleted", {
      fromVersion: currentVersion,
      toVersion: targetVersion,
    });
  }

  async getAvailableBackups(): Promise<string[]> {
    const globalBackup = await this.configurationRepository.get<
      Record<string, ExportedConfiguration>
    >(this.GLOBAL_BACKUP_KEY);
    if (!globalBackup) {
      return [];
    }

    const backupVersions = Object.keys(globalBackup);
    return backupVersions.sort((a, b) => this.compareVersions(b, a));
  }

  async deleteBackup(version: string): Promise<void> {
    const globalBackup =
      (await this.configurationRepository.get<Record<string, ExportedConfiguration>>(
        this.GLOBAL_BACKUP_KEY,
      )) || {};
    delete globalBackup[version];
    await this.configurationRepository.set(this.GLOBAL_BACKUP_KEY, globalBackup);

    await this.eventBus.publish("backupDeleted", { version });
  }

  private async createBackup(version: string): Promise<void> {
    const config = await this.getAllConfiguration();
    const globalBackup =
      (await this.configurationRepository.get<Record<string, ExportedConfiguration>>(
        this.GLOBAL_BACKUP_KEY,
      )) || {};
    globalBackup[version] = config;
    await this.configurationRepository.set(this.GLOBAL_BACKUP_KEY, globalBackup);

    await this.eventBus.publish("backupCreated", { version });
  }

  private async getAllConfiguration(): Promise<ExportedConfiguration> {
    const allConfigs = await this.configurationRepository.getAll();
    const providers: Record<string, any> = {};
    let global: any = {};

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.startsWith("provider.") && value) {
        const providerId = key.replace("provider.", "");
        providers[providerId] = value;
      } else if (key === "global" && value) {
        global = value;
      }
    }

    return {
      version: await this.getCurrentVersion(),
      exportedAt: new Date().toISOString(),
      global,
      providers,
      metadata: {
        exportedBy: "qwiki-migration",
        description: "Migration backup",
      },
    };
  }

  private async saveConfiguration(config: ExportedConfiguration): Promise<void> {
    await this.configurationRepository.set("global", config.global);

    for (const [providerId, providerConfig] of Object.entries(config.providers)) {
      await this.configurationRepository.set(`provider.${providerId}`, providerConfig);
    }
  }

  private async importConfiguration(config: ExportedConfiguration): Promise<void> {
    await this.configurationRepository.set("global", config.global);

    for (const [providerId, providerConfig] of Object.entries(config.providers)) {
      await this.configurationRepository.set(`provider.${providerId}`, providerConfig);
    }

    await this.eventBus.publish("configurationImported", { config });
  }

  private getLatestVersion(): string {
    if (this.migrationSteps.length === 0) {
      return "1.0.0";
    }

    return this.migrationSteps[this.migrationSteps.length - 1].version;
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);

    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  private initializeMigrationSteps(): void {
    this.addMigrationStep({
      version: "1.1.0",
      description: "Add backup configuration settings",
      migrate: async (config: any) => {
        if (config.global && !config.global.backupEnabled) {
          config.global.backupEnabled = true;
          config.global.backupRetentionDays = 30;
        }
        return config;
      },
      rollback: async (config: any) => {
        if (config.global) {
          delete config.global.backupEnabled;
          delete config.global.backupRetentionDays;
        }
        return config;
      },
    });

    this.addMigrationStep({
      version: "1.2.0",
      description: "Migrate provider configuration structure",
      migrate: async (config: any) => {
        const migratedProviders: Record<string, any> = {};

        for (const [providerId, providerConfig] of Object.entries(config.providers || {})) {
          const oldConfig = providerConfig as any;

          migratedProviders[providerId] = {
            id: providerId,
            name: oldConfig.name || providerId,
            enabled: oldConfig.enabled !== undefined ? oldConfig.enabled : true,
            apiKey: oldConfig.apiKey,
            model: oldConfig.model,
            temperature: oldConfig.temperature,
            maxTokens: oldConfig.maxTokens,
            topP: oldConfig.topP,
            frequencyPenalty: oldConfig.frequencyPenalty,
            presencePenalty: oldConfig.presencePenalty,
            customFields: oldConfig.customFields,
            rateLimitPerMinute: oldConfig.rateLimitPerMinute,
            timeout: oldConfig.timeout,
            retryAttempts: oldConfig.retryAttempts || 3,
            fallbackProviderIds: oldConfig.fallbackProviderIds,
          };
        }

        config.providers = migratedProviders;
        return config;
      },
      rollback: async (config: any) => {
        const originalProviders: Record<string, any> = {};

        for (const [providerId, providerConfig] of Object.entries(config.providers || {})) {
          const newConfig = providerConfig as any;

          originalProviders[providerId] = {
            name: newConfig.name,
            enabled: newConfig.enabled,
            apiKey: newConfig.apiKey,
            model: newConfig.model,
            temperature: newConfig.temperature,
            maxTokens: newConfig.maxTokens,
            topP: newConfig.topP,
            frequencyPenalty: newConfig.frequencyPenalty,
            presencePenalty: newConfig.presencePenalty,
            customFields: newConfig.customFields,
            rateLimitPerMinute: newConfig.rateLimitPerMinute,
            timeout: newConfig.timeout,
            retryAttempts: newConfig.retryAttempts,
            fallbackProviderIds: newConfig.fallbackProviderIds,
          };
        }

        config.providers = originalProviders;
        return config;
      },
    });

    this.addMigrationStep({
      version: "1.3.0",
      description: "Add performance monitoring settings",
      migrate: async (config: any) => {
        if (config.global && !config.global.enablePerformanceMonitoring) {
          config.global.enablePerformanceMonitoring = true;
          config.global.enableErrorReporting = true;
        }
        return config;
      },
      rollback: async (config: any) => {
        if (config.global) {
          delete config.global.enablePerformanceMonitoring;
          delete config.global.enableErrorReporting;
        }
        return config;
      },
    });

    this.addMigrationStep({
      version: "1.4.0",
      description: "Add language and theme settings",
      migrate: async (config: any) => {
        if (config.global) {
          if (!config.global.language) {
            config.global.language = "en";
          }
          if (!config.global.uiTheme) {
            config.global.uiTheme = "auto";
          }
        }
        return config;
      },
      rollback: async (config: any) => {
        if (config.global) {
          delete config.global.language;
          delete config.global.uiTheme;
        }
        return config;
      },
    });
  }
}
