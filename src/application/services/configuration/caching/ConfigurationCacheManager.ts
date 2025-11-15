import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import type { ProjectContextCacheInvalidationService } from "@/infrastructure/services";
import type { CachingService } from "@/infrastructure/services";
import type { GenerationCacheService } from "@/infrastructure/services";
import type { ProjectIndexService } from "@/infrastructure/services";
import { EventBus } from "@/events";

export class ConfigurationCacheManager {
  private configCache = new Map<string, any>();
  private logger: Logger;
  private cacheInvalidationService?: ProjectContextCacheInvalidationService;
  private cachingService?: CachingService;
  private generationCacheService?: GenerationCacheService;
  private projectIndexService?: ProjectIndexService;

  constructor(
    private eventBus: EventBus,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("ConfigurationCacheManager");
  }

  setCacheServices(
    cacheInvalidationService?: ProjectContextCacheInvalidationService,
    cachingService?: CachingService,
    generationCacheService?: GenerationCacheService,
    projectIndexService?: ProjectIndexService,
  ): void {
    this.cacheInvalidationService = cacheInvalidationService;
    this.cachingService = cachingService;
    this.generationCacheService = generationCacheService;
    this.projectIndexService = projectIndexService;
  }

  setCacheServicesSync(
    cacheInvalidationService?: ProjectContextCacheInvalidationService,
    cachingService?: CachingService,
    generationCacheService?: GenerationCacheService,
  ): void {
    this.cacheInvalidationService = cacheInvalidationService;
    this.cachingService = cachingService;
    this.generationCacheService = generationCacheService;
  }

  setProjectIndexService(projectIndexService: ProjectIndexService): void {
    this.projectIndexService = projectIndexService;
  }

  get<T>(key: string): T | undefined {
    return this.configCache.get(key);
  }

  set<T>(key: string, value: T): void {
    this.configCache.set(key, value);
  }

  has(key: string): boolean {
    return this.configCache.has(key);
  }

  delete(key: string): void {
    this.configCache.delete(key);
  }

  clear(): void {
    this.configCache.clear();
  }

  async refreshCache(getAllConfigs: () => Promise<Record<string, any>>): Promise<void> {
    this.configCache.clear();
    const allConfigs = await getAllConfigs();

    for (const [key, value] of Object.entries(allConfigs)) {
      this.configCache.set(key, value);
    }
  }

  async invalidateCaches(): Promise<void> {
    try {
      this.logger.info("Invalidating caches due to provider configuration change");

      if (this.cacheInvalidationService) {
        await this.cacheInvalidationService.invalidateAll();
        this.logger.info("Invalidated project context caches");
      }

      if (this.cachingService) {
        await this.cachingService.clear();
        this.logger.info("Invalidated memory cache");
      }

      if (this.generationCacheService) {
        await this.generationCacheService.invalidateCache("*");
        this.logger.info("Invalidated generation cache");
      }

      if (this.projectIndexService) {
        this.projectIndexService.invalidateCache();
        this.logger.info("Invalidated project index cache");
      }

      await this.eventBus.publish("cachesInvalidated", {
        reason: "providerConfigurationChanged",
        timestamp: Date.now(),
      });

      this.logger.info("Cache invalidation completed");
    } catch (error) {
      this.logger.error("Error invalidating caches", error);
      await this.eventBus.publish("cacheInvalidationError", {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
    }
  }
}
