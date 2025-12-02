import { EventBus } from "@/events";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import type { ConfigurationRepository } from "@/domain/repositories/ConfigurationRepository";
import type {
  ContextIntelligenceConfig,
  PromptEngineeringConfig,
  WikiManagementConfig,
  Phase4Configuration,
} from "@/domain/configuration";

export class AdvancedConfigurationManager {
  private logger: Logger;

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
    private cacheManager: {
      get: (key: string) => unknown;
      set: (key: string, value: unknown) => void;
    },
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("AdvancedConfigurationManager");
  }

  async getContextIntelligenceConfig(): Promise<ContextIntelligenceConfig | undefined> {
    const cacheKey = "phase4.contextIntelligence";
    const cached = this.cacheManager.get(cacheKey) as ContextIntelligenceConfig | undefined;
    if (cached) {
      return cached;
    }

    const config = await this.configurationRepository.get<ContextIntelligenceConfig>(cacheKey);
    if (config) {
      this.cacheManager.set(cacheKey, config);
      return config;
    }

    return this.getDefaultContextIntelligenceConfig();
  }

  async updateContextIntelligenceConfig(config: Partial<ContextIntelligenceConfig>): Promise<void> {
    const cacheKey = "phase4.contextIntelligence";
    const currentConfig = await this.getContextIntelligenceConfig();
    const updatedConfig = { ...currentConfig, ...config } as ContextIntelligenceConfig;

    await this.configurationRepository.set(cacheKey, updatedConfig);
    this.cacheManager.set(cacheKey, updatedConfig);

    await this.eventBus.publish("contextIntelligenceConfigChanged", { config: updatedConfig });
  }

  private getDefaultContextIntelligenceConfig(): ContextIntelligenceConfig {
    return {
      enableSmartContext: false,
      tokenLimits: {
        maxTotalTokens: 8000,
        reservedForPrompt: 500,
        reservedForOutput: 1000,
        utilizationTarget: 0.85,
      },
      compressionSettings: {
        enabled: false,
        strategy: "moderate",
        ratio: 0.7,
        quality: 0.8,
        preserveEssentials: true,
      },
      minRelevanceScore: 0.3,
      maxFilesToAnalyze: 200,
      essentialFilesPriority: true,
    };
  }

  async getPromptEngineeringConfig(): Promise<PromptEngineeringConfig | undefined> {
    const cacheKey = "phase4.promptEngineering";
    const cached = this.cacheManager.get(cacheKey) as PromptEngineeringConfig | undefined;
    if (cached) {
      return cached;
    }

    const config = await this.configurationRepository.get<PromptEngineeringConfig>(cacheKey);
    if (config) {
      this.cacheManager.set(cacheKey, config);
      return config;
    }

    return this.getDefaultPromptEngineeringConfig();
  }

  async updatePromptEngineeringConfig(config: Partial<PromptEngineeringConfig>): Promise<void> {
    const cacheKey = "phase4.promptEngineering";
    const currentConfig = await this.getPromptEngineeringConfig();
    const updatedConfig = { ...currentConfig, ...config } as PromptEngineeringConfig;

    await this.configurationRepository.set(cacheKey, updatedConfig);
    this.cacheManager.set(cacheKey, updatedConfig);

    await this.eventBus.publish("promptEngineeringConfigChanged", { config: updatedConfig });
  }

  private getDefaultPromptEngineeringConfig(): PromptEngineeringConfig {
    return {
      enableAdaptivePrompts: false,
      qualityThresholds: {
        minQualityScore: 0.6,
        targetQualityScore: 0.8,
        qualityImprovementThreshold: 0.1,
      },
      providerOptimizations: [],
      enableA_BTesting: false,
      enablePromptEvolution: false,
    };
  }

  async getWikiManagementConfig(): Promise<WikiManagementConfig | undefined> {
    const cacheKey = "phase4.wikiManagement";
    const cached = this.cacheManager.get(cacheKey) as WikiManagementConfig | undefined;
    if (cached) {
      return cached;
    }

    const config = await this.configurationRepository.get<WikiManagementConfig>(cacheKey);
    if (config) {
      this.cacheManager.set(cacheKey, config);
      return config;
    }

    return this.getDefaultWikiManagementConfig();
  }

  async updateWikiManagementConfig(config: Partial<WikiManagementConfig>): Promise<void> {
    const cacheKey = "phase4.wikiManagement";
    const currentConfig = await this.getWikiManagementConfig();
    const updatedConfig = { ...currentConfig, ...config } as WikiManagementConfig;

    await this.configurationRepository.set(cacheKey, updatedConfig);
    this.cacheManager.set(cacheKey, updatedConfig);

    await this.eventBus.publish("wikiManagementConfigChanged", { config: updatedConfig });
  }

  private getDefaultWikiManagementConfig(): WikiManagementConfig {
    return {
      enableAggregation: true,
      readmeUpdateSettings: {
        enabled: true,
        autoBackup: true,
        preserveCustomSections: true,
        defaultSections: [
          "## What It Is",
          "## What It Does",
          "## How It Works",
          "## Usage Examples",
          "## Important Considerations",
          "## Related Components",
        ],
        mergeStrategy: "merge",
      },
      autoBackup: true,
      backupRetentionDays: 30,
      aggregationDefaults: {
        mergeStrategy: "append",
        outputFormat: "markdown",
      },
    };
  }

  async getPhase4Config(): Promise<Phase4Configuration> {
    const [contextIntelligence, promptEngineering, wikiManagement] = await Promise.all([
      this.getContextIntelligenceConfig(),
      this.getPromptEngineeringConfig(),
      this.getWikiManagementConfig(),
    ]);

    return {
      contextIntelligence,
      promptEngineering,
      wikiManagement,
    };
  }
}
