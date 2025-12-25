import { Container } from "@/container/Container";
import type { ExtensionContext } from "vscode";
import { LoggingService } from "@/infrastructure/services";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import { ExtensionContextStorageService } from "@/infrastructure/services/storage/ExtensionContextStorageService";
import { CachingService } from "@/infrastructure/services";
import { PerformanceMonitorService } from "@/infrastructure/services/performance/PerformanceMonitorService";
import { PerformanceBudgetService } from "@/infrastructure/services/performance/PerformanceBudgetService";
import { GenerationCacheService } from "@/infrastructure/services/caching/GenerationCacheService";
import { RequestBatchingService } from "@/infrastructure/services/optimization/RequestBatchingService";
import { DebouncingService } from "@/infrastructure/services/optimization/DebouncingService";
import { RateLimiterService } from "@/infrastructure/services/optimization/RateLimiterService";
import { BackgroundProcessingService } from "@/infrastructure/services/optimization/BackgroundProcessingService";
import { MemoryOptimizationService } from "@/infrastructure/services/optimization/MemoryOptimizationService";
import { ResourceMonitorService } from "@/infrastructure/services/optimization/ResourceMonitorService";
import { VSCodeApiKeyRepository } from "@/infrastructure/repositories/VSCodeApiKeyRepository";
import { VSCodeConfigurationRepository } from "@/infrastructure/repositories/VSCodeConfigurationRepository";
import { ErrorHandlerImpl } from "@/infrastructure/services/error/ErrorHandler";
import { ErrorLoggingService } from "@/infrastructure/services/error/ErrorLoggingService";
import { ErrorRecoveryService } from "@/infrastructure/services/error/ErrorRecoveryService";
import { ErrorAnalyticsService } from "@/infrastructure/services/error/ErrorAnalyticsService";
import { QualityMetricsService } from "@/infrastructure/services/performance/QualityMetricsService";
import { UXMetricsService } from "@/infrastructure/services/performance/UXMetricsService";
import { EmbeddingService } from "@/infrastructure/services/embeddings/EmbeddingService";
import { SemanticCacheService } from "@/infrastructure/services/caching/SemanticCacheService";
import { ProjectIndexService } from "@/infrastructure/services/indexing/ProjectIndexService";
import { GitChangeDetectionService } from "@/infrastructure/services/integration/GitChangeDetectionService";
import { LanguageServerIntegrationService } from "@/infrastructure/services/integration/LanguageServerIntegrationService";
import { EventBusImpl, EventBus } from "@/events";
import { TaskSchedulerService } from "@/infrastructure/services/orchestration/TaskSchedulerService";
import { ContextCacheService } from "@/infrastructure/services/caching/ContextCacheService";
import { ProgressService } from "@/application/services/ProgressService";

export function registerInfrastructureServices(
  container: Container,
  context: ExtensionContext,
  loggingService: LoggingService,
): void {
  container.registerInstance("loggingService", loggingService);
  container.registerInstance("taskScheduler", new TaskSchedulerService(loggingService));
  container.registerInstance("progressService", new ProgressService(loggingService));
  container.registerInstance(
    "vscodeFileSystemService",
    new VSCodeFileSystemService(loggingService),
  );
  container.registerInstance("context", context);
  container.registerInstance("secrets", context.secrets);

  container.registerInstance(
    "extensionContextStorageService",
    new ExtensionContextStorageService(context, loggingService),
  );
  container.registerInstance("cachingService", new CachingService());
  container.registerInstance("performanceMonitor", new PerformanceMonitorService());
  container.registerInstance(
    "performanceBudgetService",
    new PerformanceBudgetService(loggingService),
  );
  
  container.registerLazy("generationCacheService", async () => {
    const configRepo = container.resolve("configurationRepository") as import("@/domain/repositories/ConfigurationRepository").ConfigurationRepository;
    
    const enableSemanticCaching = await configRepo.get<boolean>("enableSemanticCaching") ?? false;
    const semanticThreshold = await configRepo.get<number>("semanticSimilarityThreshold") ?? 0.8;
    const semanticMaxEntries = await configRepo.get<number>("semanticCacheMaxEntries") ?? 100;
    
    return new GenerationCacheService(
      container.resolve("cachingService") as CachingService,
      enableSemanticCaching ? container.resolve("semanticCacheService") : undefined,
      loggingService,
      enableSemanticCaching,
      semanticThreshold,
    );
  });
  container.registerInstance("requestBatchingService", new RequestBatchingService(loggingService));
  container.registerInstance("debouncingService", new DebouncingService());
  container.registerInstance("rateLimiterService", new RateLimiterService(loggingService));
  container.registerInstance("backgroundProcessingService", new BackgroundProcessingService());
  const memoryOptimizationService = new MemoryOptimizationService();
  container.registerInstance("memoryOptimizationService", memoryOptimizationService);
  container.registerInstance(
    "resourceMonitorService",
    new ResourceMonitorService(memoryOptimizationService, loggingService),
  );

  container.register(
    "apiKeyRepository",
    () => new VSCodeApiKeyRepository(container.resolve("secrets") as import("vscode").SecretStorage, loggingService),
  );

  container.register("configurationRepository", () => new VSCodeConfigurationRepository());

  container.register(
    "errorHandler",
    () => new ErrorHandlerImpl(container.resolve("eventBus"), loggingService),
  );

  container.register("errorLoggingService", () => new ErrorLoggingService(loggingService));

  container.register(
    "errorRecoveryService",
    () =>
      new ErrorRecoveryService(
        container.resolve("eventBus"),
        container.resolve("memoryOptimizationService") as MemoryOptimizationService,
        loggingService,
      ),
  );

  container.register(
    "gitChangeDetectionService",
    () => new GitChangeDetectionService(loggingService, container.resolve("eventBus"), context),
  );

  container.registerLazy("projectIndexService", async () => {
    const service = new ProjectIndexService(
      context,
      loggingService,
      container.resolve("debouncingService") as DebouncingService,
      container.resolve("gitChangeDetectionService") as GitChangeDetectionService,
      container.resolve("taskScheduler") as TaskSchedulerService,
    );
    await service.quickInit();
    return service;
  });

  container.registerLazy("languageServerIntegrationService", async () => {
    const projectIndexService = (await container.resolveLazy(
      "projectIndexService",
    )) as ProjectIndexService;
    const indexCacheService = projectIndexService.getIndexCacheService();
    return new LanguageServerIntegrationService(
      loggingService,
      container.resolve("eventBus"),
      container.resolve("debouncingService") as DebouncingService,
      container.resolve("cachingService") as CachingService,
      indexCacheService,
    );
  });

  const eventBus = new EventBusImpl(loggingService);
  container.registerInstance("eventBus", eventBus);

  container.register(
    "errorAnalyticsService",
    () => new ErrorAnalyticsService(container.resolve("eventBus") as EventBus, loggingService),
  );

  container.register(
    "qualityMetricsService",
    () => new QualityMetricsService(container.resolve("eventBus") as EventBus, loggingService),
  );

  container.register(
    "uxMetricsService",
    () => new UXMetricsService(container.resolve("eventBus") as EventBus, loggingService),
  );

  container.register("embeddingService", () => new EmbeddingService(loggingService));

  container.register(
    "semanticCacheService",
    () =>
      new SemanticCacheService(
        container.resolve("cachingService") as CachingService,
        container.resolve("embeddingService") as EmbeddingService,
        loggingService,
      ),
  );

  container.registerLazy("contextCache", async () => {
    const taskScheduler = container.resolve("taskScheduler") as TaskSchedulerService;
    const service = new ContextCacheService(context, loggingService, taskScheduler);
    await service.initialize();
    return service;
  });
}
