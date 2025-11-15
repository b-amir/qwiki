import { EventBus } from "@/events";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import type { ConfigurationRepository } from "@/domain/repositories/ConfigurationRepository";
import type { GlobalConfiguration } from "@/domain/configuration";
import { ServiceLimits } from "@/constants";

export class GlobalConfigurationManager {
  private logger: Logger;

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
    private cacheManager: {
      has: (key: string) => boolean;
      get: <T>(key: string) => T | undefined;
      set: <T>(key: string, value: T) => void;
    },
    loggingService?: LoggingService,
  ) {
    this.logger = loggingService
      ? createLogger("GlobalConfigurationManager")
      : {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        };
  }

  async getGlobalConfig(): Promise<GlobalConfiguration> {
    const cacheKey = "global";
    if (this.cacheManager.has(cacheKey)) {
      const cached = this.cacheManager.get<GlobalConfiguration>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const config = await this.configurationRepository.get<GlobalConfiguration>(cacheKey);
    const defaultConfig: GlobalConfiguration = {
      defaultProviderId: undefined,
      autoGenerateWiki: false,
      wikiOutputFormat: "markdown",
      maxContextLength: ServiceLimits.maxContextLength,
      enableCaching: true,
      cacheExpirationHours: 24,
      enablePerformanceMonitoring: true,
      enableErrorReporting: true,
      logLevel: "error",
      uiTheme: "auto",
      language: "en",
      autoSave: true,
      backupEnabled: true,
      backupRetentionDays: 30,
    };

    const finalConfig = config || defaultConfig;
    this.cacheManager.set(cacheKey, finalConfig);
    return finalConfig;
  }

  async setGlobalConfig(config: Partial<GlobalConfiguration>): Promise<void> {
    const cacheKey = "global";
    const currentConfig = await this.getGlobalConfig();
    const updatedConfig = { ...currentConfig, ...config };

    await this.configurationRepository.set(cacheKey, updatedConfig);
    this.cacheManager.set(cacheKey, updatedConfig);

    await this.eventBus.publish("globalConfigChanged", { config: updatedConfig });
  }
}
