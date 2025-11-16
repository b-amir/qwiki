import { Container } from "@/container/Container";
import type { ExtensionContext } from "vscode";
import { LoggingService } from "@/infrastructure/services";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import { ExtensionContextStorageService } from "@/infrastructure/services/storage/ExtensionContextStorageService";
import { CachingService } from "@/infrastructure/services";
import { PerformanceMonitorService } from "@/infrastructure/services/performance/PerformanceMonitorService";
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
import { ProjectIndexService } from "@/infrastructure/services/indexing/ProjectIndexService";
import { GitChangeDetectionService } from "@/infrastructure/services/integration/GitChangeDetectionService";
import { LanguageServerIntegrationService } from "@/infrastructure/services/integration/LanguageServerIntegrationService";
import { EventBusImpl } from "@/events";
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
    "generationCacheService",
    new GenerationCacheService(container.resolve("cachingService") as CachingService),
  );
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
    () => new VSCodeApiKeyRepository(container.resolve("secrets") as any, loggingService),
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
    );
    await service.initialize();
    return service;
  });

  container.registerLazy("languageServerIntegrationService", async () => {
    return new LanguageServerIntegrationService(
      loggingService,
      container.resolve("eventBus"),
      container.resolve("debouncingService") as DebouncingService,
      container.resolve("cachingService") as CachingService,
    );
  });

  const eventBus = new EventBusImpl(loggingService);
  container.registerInstance("eventBus", eventBus);

  container.registerLazy("contextCache", async () => {
    const taskScheduler = container.resolve("taskScheduler") as TaskSchedulerService;
    const service = new ContextCacheService(context, loggingService, taskScheduler);
    await service.initialize();
    return service;
  });
}
