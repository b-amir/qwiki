import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import { ConfigurationError } from "../../errors";
import { ConfigurationKeys, ConfigurationDefaults } from "../../constants";

export interface MigrationStep {
  version: string;
  description: string;
  migrate: (config: Record<string, any>) => Promise<Record<string, any>>;
}

export class ConfigurationMigration {
  private readonly migrations: MigrationStep[] = [
    {
      version: "1.0.0",
      description: "Initial configuration setup",
      migrate: async (config) => {
        const newConfig = { ...config };
        
        if (newConfig[ConfigurationKeys.zaiBaseUrl] === undefined) {
          newConfig[ConfigurationKeys.zaiBaseUrl] = ConfigurationDefaults[ConfigurationKeys.zaiBaseUrl];
        }
        
        if (newConfig[ConfigurationKeys.googleAIEndpoint] === undefined) {
          newConfig[ConfigurationKeys.googleAIEndpoint] = ConfigurationDefaults[ConfigurationKeys.googleAIEndpoint];
        }
        
        return newConfig;
      },
    },
    {
      version: "1.0.1",
      description: "Migrate legacy endpoint configuration",
      migrate: async (config) => {
        const newConfig = { ...config };
        
        if (config.googleAIEndpoint === "openai" || config.googleAIEndpoint === "openai-compatible") {
          newConfig[ConfigurationKeys.googleAIEndpoint] = "openai-compatible";
        } else if (config.googleAIEndpoint === "native") {
          newConfig[ConfigurationKeys.googleAIEndpoint] = "native";
        }
        
        return newConfig;
      },
    },
  ];

  constructor(private configurationRepository: ConfigurationRepository) {}

  async migrate(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const config = await this.configurationRepository.getAll();
    
    let migratedConfig = { ...config };
    let appliedMigrations = false;

    for (const migration of this.migrations) {
      if (this.shouldApplyMigration(currentVersion, migration.version)) {
        try {
          migratedConfig = await migration.migrate(migratedConfig);
          appliedMigrations = true;
        } catch (error) {
          throw new ConfigurationError(
            "invalidConfiguration",
            `Failed to apply migration ${migration.version}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    if (appliedMigrations) {
      await this.saveMigratedConfiguration(migratedConfig);
      await this.updateVersion(this.getLatestVersion());
    }
  }

  private async getCurrentVersion(): Promise<string> {
    return (await this.configurationRepository.get<string>("configurationVersion")) || "0.0.0";
  }

  private async updateVersion(version: string): Promise<void> {
    await this.configurationRepository.set("configurationVersion", version);
  }

  private shouldApplyMigration(currentVersion: string, migrationVersion: string): boolean {
    return this.compareVersions(currentVersion, migrationVersion) < 0;
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  private getLatestVersion(): string {
    if (this.migrations.length === 0) return "1.0.0";
    return this.migrations[this.migrations.length - 1].version;
  }

  private async saveMigratedConfiguration(config: Record<string, any>): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      await this.configurationRepository.set(key, value);
    }
  }

  async needsMigration(): Promise<boolean> {
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = this.getLatestVersion();
    return this.shouldApplyMigration(currentVersion, latestVersion);
  }

  getMigrationHistory(): MigrationStep[] {
    return [...this.migrations];
  }
}