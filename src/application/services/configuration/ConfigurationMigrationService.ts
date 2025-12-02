import type {
  MigrationStep,
  ExportedConfiguration,
  ProviderConfigurationMap,
  ProviderConfiguration,
  GlobalConfiguration,
} from "@/domain/configuration";
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

        config = (await migration.migrate(config)) as ExportedConfiguration;

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
    const providers: ProviderConfigurationMap = {};
    let global: Partial<GlobalConfiguration> = {};

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.startsWith("provider.") && value) {
        const providerId = key.replace("provider.", "");
        providers[providerId] = value as ProviderConfiguration;
      } else if (key === "global" && value) {
        global = value as Partial<GlobalConfiguration>;
      }
    }

    return {
      version: await this.getCurrentVersion(),
      exportedAt: new Date().toISOString(),
      global: global as GlobalConfiguration,
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
      migrate: async (config: unknown) => {
        const cfg = config as ExportedConfiguration;
        if (cfg.global) {
          const global = cfg.global as unknown as Record<string, unknown>;
          if (!global.backupEnabled) {
            global.backupEnabled = true;
            global.backupRetentionDays = 30;
          }
        }
        return cfg;
      },
      rollback: async (config: unknown) => {
        const cfg = config as ExportedConfiguration;
        if (cfg.global) {
          const global = cfg.global as unknown as Record<string, unknown>;
          if ("backupEnabled" in global) {
            delete global.backupEnabled;
          }
          if ("backupRetentionDays" in global) {
            delete global.backupRetentionDays;
          }
        }
        return cfg;
      },
    });

    this.addMigrationStep({
      version: "1.2.0",
      description: "Migrate provider configuration structure",
      migrate: async (config: unknown) => {
        const cfg = config as ExportedConfiguration;
        const migratedProviders: Record<string, unknown> = {};

        for (const [providerId, providerConfig] of Object.entries(cfg.providers || {})) {
          const oldConfig = providerConfig as unknown as Record<string, unknown>;

          migratedProviders[providerId] = {
            id: providerId,
            name: (typeof oldConfig.name === "string" ? oldConfig.name : undefined) || providerId,
            enabled: oldConfig.enabled !== undefined ? Boolean(oldConfig.enabled) : true,
            apiKey: typeof oldConfig.apiKey === "string" ? oldConfig.apiKey : undefined,
            model: typeof oldConfig.model === "string" ? oldConfig.model : undefined,
            temperature:
              typeof oldConfig.temperature === "number" ? oldConfig.temperature : undefined,
            maxTokens: typeof oldConfig.maxTokens === "number" ? oldConfig.maxTokens : undefined,
            topP: typeof oldConfig.topP === "number" ? oldConfig.topP : undefined,
            frequencyPenalty:
              typeof oldConfig.frequencyPenalty === "number"
                ? oldConfig.frequencyPenalty
                : undefined,
            presencePenalty:
              typeof oldConfig.presencePenalty === "number" ? oldConfig.presencePenalty : undefined,
            customFields:
              typeof oldConfig.customFields === "object" && oldConfig.customFields !== null
                ? (oldConfig.customFields as Record<string, unknown>)
                : undefined,
            rateLimitPerMinute:
              typeof oldConfig.rateLimitPerMinute === "number"
                ? oldConfig.rateLimitPerMinute
                : undefined,
            timeout: typeof oldConfig.timeout === "number" ? oldConfig.timeout : undefined,
            retryAttempts:
              typeof oldConfig.retryAttempts === "number" ? oldConfig.retryAttempts : 3,
            fallbackProviderIds: Array.isArray(oldConfig.fallbackProviderIds)
              ? (oldConfig.fallbackProviderIds as string[])
              : undefined,
          };
        }

        cfg.providers = migratedProviders as ProviderConfigurationMap;
        return cfg;
      },
      rollback: async (config: unknown) => {
        const cfg = config as ExportedConfiguration;
        const originalProviders: Record<string, unknown> = {};

        for (const [providerId, providerConfig] of Object.entries(cfg.providers || {})) {
          const newConfig = providerConfig as unknown as Record<string, unknown>;

          originalProviders[providerId] = {
            name: typeof newConfig.name === "string" ? newConfig.name : providerId,
            enabled: typeof newConfig.enabled === "boolean" ? newConfig.enabled : true,
            apiKey: typeof newConfig.apiKey === "string" ? newConfig.apiKey : undefined,
            model: typeof newConfig.model === "string" ? newConfig.model : undefined,
            temperature:
              typeof newConfig.temperature === "number" ? newConfig.temperature : undefined,
            maxTokens: typeof newConfig.maxTokens === "number" ? newConfig.maxTokens : undefined,
            topP: typeof newConfig.topP === "number" ? newConfig.topP : undefined,
            frequencyPenalty:
              typeof newConfig.frequencyPenalty === "number"
                ? newConfig.frequencyPenalty
                : undefined,
            presencePenalty:
              typeof newConfig.presencePenalty === "number" ? newConfig.presencePenalty : undefined,
            customFields:
              typeof newConfig.customFields === "object" && newConfig.customFields !== null
                ? (newConfig.customFields as Record<string, unknown>)
                : undefined,
            rateLimitPerMinute:
              typeof newConfig.rateLimitPerMinute === "number"
                ? newConfig.rateLimitPerMinute
                : undefined,
            timeout: typeof newConfig.timeout === "number" ? newConfig.timeout : undefined,
            retryAttempts:
              typeof newConfig.retryAttempts === "number" ? newConfig.retryAttempts : undefined,
            fallbackProviderIds: Array.isArray(newConfig.fallbackProviderIds)
              ? (newConfig.fallbackProviderIds as string[])
              : undefined,
          };
        }

        cfg.providers = originalProviders as ProviderConfigurationMap;
        return cfg;
      },
    });

    this.addMigrationStep({
      version: "1.3.0",
      description: "Add performance monitoring settings",
      migrate: async (config: unknown) => {
        const cfg = config as ExportedConfiguration;
        if (cfg.global && !cfg.global.enablePerformanceMonitoring) {
          cfg.global.enablePerformanceMonitoring = true;
          cfg.global.enableErrorReporting = true;
        }
        return cfg;
      },
      rollback: async (config: unknown) => {
        const cfg = config as ExportedConfiguration;
        if (cfg.global) {
          const global = cfg.global as unknown as Record<string, unknown>;
          if ("enablePerformanceMonitoring" in global) {
            delete global.enablePerformanceMonitoring;
          }
          if ("enableErrorReporting" in global) {
            delete global.enableErrorReporting;
          }
        }
        return cfg;
      },
    });

    this.addMigrationStep({
      version: "1.4.0",
      description: "Add language and theme settings",
      migrate: async (config: unknown) => {
        const cfg = config as ExportedConfiguration;
        if (cfg.global) {
          const global = cfg.global as unknown as Record<string, unknown>;
          if (!global.language) {
            global.language = "en";
          }
          if (!global.uiTheme) {
            global.uiTheme = "auto";
          }
        }
        return cfg;
      },
      rollback: async (config: unknown) => {
        const cfg = config as ExportedConfiguration;
        if (cfg.global) {
          const global = cfg.global as unknown as Record<string, unknown>;
          if ("language" in global) {
            delete global.language;
          }
          if ("uiTheme" in global) {
            delete global.uiTheme;
          }
        }
        return cfg;
      },
    });
  }
}
