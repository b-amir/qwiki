import { Container } from "@/container/Container";
import { ServiceReadinessManager } from "@/infrastructure/services/ServiceReadinessManager";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { ProjectIndexService } from "@/infrastructure/services/indexing/ProjectIndexService";
import { ProviderHealthService } from "@/infrastructure/services/providers/ProviderHealthService";
import { ProjectContextCacheInvalidationService } from "@/infrastructure/services/caching/ProjectContextCacheInvalidationService";
import { WikiWatcherService } from "@/infrastructure/services/storage/WikiWatcherService";
import { MemoryOptimizationService } from "@/infrastructure/services/optimization/MemoryOptimizationService";
import { BackgroundProcessingService } from "@/infrastructure/services/optimization/BackgroundProcessingService";
import { ContextCacheService } from "@/infrastructure/services/caching/ContextCacheService";
import type { EventBus } from "@/events";

export class BackgroundServicesInitializer {
  private logger: Logger;

  constructor(
    private container: Container,
    private readinessManager: ServiceReadinessManager,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("BackgroundServicesInitializer");
  }

  async initialize(): Promise<void> {
    this.logger.info("Starting background services initialization");

    const backgroundTasks = [
      this.initProjectIndexService(),
      this.initProviderHealthService(),
      this.initContextIntelligenceService(),
      this.initContextCacheService(),
    ];

    let completed = 0;
    const total = backgroundTasks.length;

    backgroundTasks.forEach((task, index) => {
      task
        .then(() => {
          completed++;
          const percent = Math.round((completed / total) * 100);
          this.logger.info(`Background service ${index + 1}/${total} ready`, { percent });

          const eventBus = this.container.resolve("eventBus") as EventBus;
          eventBus
            .publish("backgroundInitProgress", {
              completed,
              total,
              percent,
            })
            .catch((err) => {
              this.logger.warn("Failed to publish backgroundInitProgress event", err);
            });
        })
        .catch((error) => {
          this.logger.error(`Background service ${index + 1} failed`, error);
        });
    });

    Promise.all(backgroundTasks)
      .then(() => {
        this.logger.info("All background services initialized");
      })
      .catch((error) => {
        this.logger.error("Some background services failed", error);
      });
  }

  private async initProjectIndexService(): Promise<void> {
    try {
      this.readinessManager.markInitializing("projectIndexService");
      const startTime = Date.now();

      const projectIndexService = (await this.container.resolveLazy(
        "projectIndexService",
      )) as ProjectIndexService;

      await projectIndexService.quickInit();

      const quickDuration = Date.now() - startTime;
      this.readinessManager.markReady("projectIndexService", { initDuration: quickDuration });
      this.logger.info("ProjectIndexService quick initialization complete", { duration: quickDuration });

      projectIndexService
        .initialize()
        .then(() => {
          this.logger.info("ProjectIndexService fully initialized (background)");
        })
        .catch((err) => {
          this.logger.error("Failed to initialize project index (background)", err);
        });

      const cacheInvalidationService = this.container.resolve(
        "projectContextCacheInvalidationService",
      ) as ProjectContextCacheInvalidationService;
      cacheInvalidationService.startWatching();

      const wikiWatcherService = this.container.resolve("wikiWatcherService") as WikiWatcherService;
      wikiWatcherService.startWatching();
    } catch (error) {
      this.readinessManager.markFailed("projectIndexService", error as Error);
      throw error;
    }
  }

  private async initProviderHealthService(): Promise<void> {
    try {
      this.readinessManager.markInitializing("providerHealthService");
      const startTime = Date.now();

      const healthService = (await this.container.resolveLazy(
        "providerHealthService",
      )) as ProviderHealthService;
      healthService.startHealthMonitoring();

      const duration = Date.now() - startTime;
      this.readinessManager.markReady("providerHealthService", { initDuration: duration });
      this.logger.info("ProviderHealthService initialized", { duration });
    } catch (error) {
      this.readinessManager.markFailed("providerHealthService", error as Error);
      this.logger.warn(
        "ProviderHealthService failed, continuing with degraded functionality",
        error,
      );
    }
  }

  private async initContextIntelligenceService(): Promise<void> {
    try {
      this.readinessManager.markInitializing("contextIntelligenceService");
      const startTime = Date.now();

      await this.container.resolveLazy("contextIntelligenceService");

      const memoryOptimizationService = this.container.resolve(
        "memoryOptimizationService",
      ) as MemoryOptimizationService;
      memoryOptimizationService.setMemoryLimit(512 * 1024 * 1024);
      memoryOptimizationService.scheduleCleanup(60000);
      memoryOptimizationService.enableLeakDetection(true);

      const backgroundProcessingService = this.container.resolve(
        "backgroundProcessingService",
      ) as BackgroundProcessingService;
      backgroundProcessingService.setMaxConcurrentTasks(3);

      const duration = Date.now() - startTime;
      this.readinessManager.markReady("contextIntelligenceService", { initDuration: duration });
      this.logger.info("ContextIntelligenceService initialized", { duration });
    } catch (error) {
      this.readinessManager.markFailed("contextIntelligenceService", error as Error);
      throw error;
    }
  }

  private async initContextCacheService(): Promise<void> {
    try {
      this.readinessManager.markInitializing("contextCache");
      const startTime = Date.now();

      await this.container.resolveLazy("contextCache");

      const duration = Date.now() - startTime;
      this.readinessManager.markReady("contextCache", { initDuration: duration });
      this.logger.info("ContextCacheService initialized", { duration });
    } catch (error) {
      this.readinessManager.markFailed("contextCache", error as Error);
      this.logger.warn("ContextCacheService failed, continuing without cache", error);
    }
  }
}
