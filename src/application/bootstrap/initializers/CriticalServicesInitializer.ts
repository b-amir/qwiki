import { Container } from "@/container/Container";
import { ServiceReadinessManager } from "@/infrastructure/services/ServiceReadinessManager";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import { ConfigurationMigrationService } from "@/application/services/configuration/ConfigurationMigrationService";
import { CachingService } from "@/infrastructure/services";
import { GenerationCacheService } from "@/infrastructure/services/caching/GenerationCacheService";
import { ProjectContextCacheInvalidationService } from "@/infrastructure/services/caching/ProjectContextCacheInvalidationService";

export class CriticalServicesInitializer {
  private logger: Logger;

  constructor(
    private container: Container,
    private readinessManager: ServiceReadinessManager,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("CriticalServicesInitializer");
  }

  async initialize(): Promise<void> {
    const startTime = Date.now();
    this.logger.info("Starting critical services initialization");

    try {
      this.readinessManager.markReady("loggingService");
      this.readinessManager.markReady("eventBus");

      await this.initializeConfiguration();

      this.readinessManager.markReady("messageBus");
      this.readinessManager.markReady("commandRegistry");

      const duration = Date.now() - startTime;
      this.logger.info("Critical services initialized", { duration });

      if (duration > 500) {
        this.logger.warn("Critical init exceeded 500ms", { duration });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error("Critical services initialization failed", { error, duration });
      throw error;
    }
  }

  private async initializeConfiguration(): Promise<void> {
    this.readinessManager.markInitializing("configurationManager");
    const configManager = this.container.resolve(
      "configurationManager",
    ) as ConfigurationManagerService;

    await configManager.loadCachedProvider();

    const cachingService = this.container.resolve("cachingService") as CachingService;
    const generationCacheService = this.container.resolve(
      "generationCacheService",
    ) as GenerationCacheService;
    const cacheInvalidationService = this.container.resolve(
      "projectContextCacheInvalidationService",
    ) as ProjectContextCacheInvalidationService;

    configManager.setCacheServicesSync(
      cacheInvalidationService,
      cachingService,
      generationCacheService,
    );

    await configManager.initialize();

    const migrationService = this.container.resolve(
      "configurationMigrationService",
    ) as ConfigurationMigrationService;
    if (await migrationService.needsMigration()) {
      await migrationService.migrateToVersion("1.4.0");
    }

    this.readinessManager.markReady("configurationManager");
  }
}
