import { workspace, type ExtensionContext } from "vscode";
import type { ConfigurationRepository } from "@/domain/repositories/ConfigurationRepository";
import type {
  ValidationResult,
  ExportedConfiguration,
  ContextIntelligenceConfig,
  PromptEngineeringConfig,
  WikiManagementConfig,
  Phase4Configuration,
} from "@/domain/configuration";
import { EventBus } from "@/events";
import type { ConfigurationValidationEngineService } from "@/application/services/configuration/ConfigurationValidationEngineService";
import type { ConfigurationTemplateService } from "@/application/services/configuration/ConfigurationTemplateService";
import type {
  ConfigurationImportExportService,
  ExportOptions,
  ImportOptions,
} from "./ConfigurationImportExportService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import type { ProjectContextCacheInvalidationService } from "@/infrastructure/services";
import type { CachingService } from "@/infrastructure/services";
import type { GenerationCacheService } from "@/infrastructure/services";
import type { ProjectIndexService } from "@/infrastructure/services";
import type { LLMRegistry } from "@/llm";
import { ConfigurationCacheManager } from "@/application/services/configuration/caching/ConfigurationCacheManager";
import { ConfigurationValidator } from "@/application/services/configuration/validation/ConfigurationValidator";
import { AdvancedConfigurationManager } from "@/application/services/configuration/management/AdvancedConfigurationManager";
import { ProviderConfigurationManager } from "@/application/services/configuration/management/ProviderConfigurationManager";
import { GlobalConfigurationManager } from "@/application/services/configuration/management/GlobalConfigurationManager";
import { ConfigurationRepositoryWrapper } from "@/application/services/configuration/management/ConfigurationRepositoryWrapper";

export class ConfigurationManagerService {
  private logger: Logger;
  private disposables: Array<{ dispose(): void }> = [];
  private cacheManager: ConfigurationCacheManager;
  private validator: ConfigurationValidator;
  private advancedConfigManager: AdvancedConfigurationManager;
  private providerManager: ProviderConfigurationManager;
  private globalManager: GlobalConfigurationManager;
  private repositoryWrapper: ConfigurationRepositoryWrapper;

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
    private validationEngine: ConfigurationValidationEngineService,
    private templateService: ConfigurationTemplateService,
    private importExportService: ConfigurationImportExportService,
    private ctx?: ExtensionContext,
    private loggingService?: LoggingService,
  ) {
    this.logger = loggingService
      ? createLogger("ConfigurationManagerService")
      : {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        };

    this.cacheManager = new ConfigurationCacheManager(
      eventBus,
      loggingService || new LoggingService(),
    );
    this.validator = new ConfigurationValidator(loggingService || new LoggingService());
    this.advancedConfigManager = new AdvancedConfigurationManager(
      configurationRepository,
      eventBus,
      this.cacheManager,
      loggingService || new LoggingService(),
    );
    this.providerManager = new ProviderConfigurationManager(
      configurationRepository,
      eventBus,
      validationEngine,
      this.validator,
      this.cacheManager,
      undefined,
      loggingService,
    );
    this.globalManager = new GlobalConfigurationManager(
      configurationRepository,
      eventBus,
      this.cacheManager,
      loggingService,
    );
    this.repositoryWrapper = new ConfigurationRepositoryWrapper(
      configurationRepository,
      this.cacheManager,
    );
  }

  setCacheServices(
    cacheInvalidationService?: ProjectContextCacheInvalidationService,
    cachingService?: CachingService,
    generationCacheService?: GenerationCacheService,
    projectIndexService?: ProjectIndexService,
  ): void {
    this.cacheManager.setCacheServices(
      cacheInvalidationService,
      cachingService,
      generationCacheService,
      projectIndexService,
    );
  }

  setCacheServicesSync(
    cacheInvalidationService?: ProjectContextCacheInvalidationService,
    cachingService?: CachingService,
    generationCacheService?: GenerationCacheService,
  ): void {
    this.cacheManager.setCacheServicesSync(
      cacheInvalidationService,
      cachingService,
      generationCacheService,
    );
  }

  setProjectIndexService(projectIndexService: ProjectIndexService): void {
    this.cacheManager.setProjectIndexService(projectIndexService);
  }

  setLlmRegistry(llmRegistry: LLMRegistry): void {
    this.providerManager.setLlmRegistry(llmRegistry);
  }

  async loadCachedProvider(): Promise<void> {
    if (!this.ctx) {
      return;
    }

    try {
      const cachedProviderId = this.ctx.globalState.get<string>("lastProviderId");
      if (cachedProviderId) {
        this.logger.info("Loaded cached provider ID", { providerId: cachedProviderId });
        this.cacheManager.set("cachedProviderId", cachedProviderId);
      }
    } catch (error) {
      this.logger.warn("Failed to load cached provider", error);
    }
  }

  getCachedProviderId(): string | null {
    return this.cacheManager.get("cachedProviderId") || null;
  }

  async setActiveProvider(providerId: string): Promise<void> {
    this.cacheManager.set("cachedProviderId", providerId);

    if (this.ctx) {
      try {
        await this.ctx.globalState.update("lastProviderId", providerId);
        this.logger.info("Cached provider ID", { providerId });
      } catch (error) {
        this.logger.warn("Failed to persist lastProviderId", error);
      }
    }

    await this.eventBus.publish("providerChanged", { providerId });
  }

  async initialize(): Promise<void> {
    await this.repositoryWrapper.refreshCache();
    this.setupConfigurationChangeListener();
  }

  private setupConfigurationChangeListener(): void {
    if (!this.ctx) {
      return;
    }

    const configurationChangeListener = workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("qwiki")) {
        const providerConfigChanged = e.affectsConfiguration("qwiki.provider");
        this.logger.info("Qwiki configuration changed, reloading...", {
          providerConfigChanged,
        });

        try {
          await this.reloadConfiguration();

          if (providerConfigChanged) {
            await this.cacheManager.invalidateCaches();
          }

          this.logger.info("Configuration reloaded successfully");
        } catch (error) {
          this.logger.error("Failed to reload configuration after change", error);
        }
      }
    });

    this.disposables.push(configurationChangeListener);
    this.ctx.subscriptions.push(configurationChangeListener);
  }

  async reloadConfiguration(): Promise<void> {
    this.cacheManager.clear();
    await this.repositoryWrapper.refreshCache();
    await this.eventBus.publish("configurationReloaded", {});
  }

  async getProviderConfig(providerId: string) {
    return this.providerManager.getProviderConfig(providerId);
  }

  async setProviderConfig(providerId: string, config: any): Promise<void> {
    return this.providerManager.setProviderConfig(providerId, config);
  }

  async getGlobalConfig() {
    return this.globalManager.getGlobalConfig();
  }

  async setGlobalConfig(config: any): Promise<void> {
    return this.globalManager.setGlobalConfig(config);
  }

  async validateConfiguration(config: any, schema: any): Promise<ValidationResult> {
    return this.validator.validateConfiguration(config, schema);
  }

  clearCache(): void {
    this.cacheManager.clear();
  }

  async exportConfigurationWithImportExportService(
    options: ExportOptions = {},
  ): Promise<ExportedConfiguration> {
    const global = await this.getGlobalConfig();
    const allConfigs = await this.configurationRepository.getAll();
    const providers: Record<string, any> = {};

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.startsWith("provider.") && value) {
        const providerId = key.replace("provider.", "");
        providers[providerId] = value;
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
    return this.repositoryWrapper.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    return this.repositoryWrapper.set(key, value);
  }

  async getAll(): Promise<Record<string, any>> {
    return this.repositoryWrapper.getAll();
  }

  async reset(key?: string): Promise<void> {
    return this.repositoryWrapper.reset(key);
  }

  async refreshCache(): Promise<void> {
    return this.repositoryWrapper.refreshCache();
  }

  async getWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    return this.repositoryWrapper.getWithDefault(key, defaultValue);
  }

  async applyTemplate(templateId: string, variables: Record<string, any>): Promise<void> {
    await this.templateService.applyTemplate(templateId, variables);
  }

  async getContextIntelligenceConfig(): Promise<ContextIntelligenceConfig | undefined> {
    return this.advancedConfigManager.getContextIntelligenceConfig();
  }

  async updateContextIntelligenceConfig(config: Partial<ContextIntelligenceConfig>): Promise<void> {
    return this.advancedConfigManager.updateContextIntelligenceConfig(config);
  }

  async getPromptEngineeringConfig(): Promise<PromptEngineeringConfig | undefined> {
    return this.advancedConfigManager.getPromptEngineeringConfig();
  }

  async updatePromptEngineeringConfig(config: Partial<PromptEngineeringConfig>): Promise<void> {
    return this.advancedConfigManager.updatePromptEngineeringConfig(config);
  }

  async getWikiManagementConfig(): Promise<WikiManagementConfig | undefined> {
    return this.advancedConfigManager.getWikiManagementConfig();
  }

  async updateWikiManagementConfig(config: Partial<WikiManagementConfig>): Promise<void> {
    return this.advancedConfigManager.updateWikiManagementConfig(config);
  }

  async getAdvancedConfig(): Promise<Phase4Configuration> {
    return this.advancedConfigManager.getPhase4Config();
  }
}
