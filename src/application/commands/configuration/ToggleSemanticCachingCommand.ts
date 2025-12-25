import type { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class ToggleSemanticCachingCommand {
  private logger: Logger;

  constructor(
    private configurationManager: ConfigurationManagerService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ToggleSemanticCachingCommand");
  }

  async execute(): Promise<void> {
    const globalConfig = await this.configurationManager.getGlobalConfig();
    const currentValue = globalConfig.enableSemanticCaching;
    const newValue = !currentValue;

    await this.configurationManager.setGlobalConfig({
      enableSemanticCaching: newValue,
    });

    this.logger.info(`Semantic caching ${newValue ? "enabled" : "disabled"}`);
  }

  async getStatus(): Promise<{
    enabled: boolean;
    threshold: number;
    maxEntries: number;
  }> {
    const globalConfig = await this.configurationManager.getGlobalConfig();

    return {
      enabled: globalConfig.enableSemanticCaching,
      threshold: globalConfig.semanticSimilarityThreshold,
      maxEntries: globalConfig.semanticCacheMaxEntries,
    };
  }
}
