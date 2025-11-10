import { Container } from "../container/Container";
import { ServiceReadinessManager } from "../infrastructure/services/ServiceReadinessManager";
import { SERVICE_TIERS, COMMAND_REQUIREMENTS } from "../constants/ServiceTiers";
import {
  CommandRegistry,
  SelectionService,
  ProjectContextService,
  CachedProjectContextService,
  WikiService,
  CachedWikiService,
  MessageBusService,
  ConfigurationManagerService,
  ConfigurationMigrationService,
  ConfigurationTemplateService,
  ConfigurationValidationEngineService,
  ConfigurationImportExportService,
  ProviderSelectionService,
  ContextAnalysisService,
  WikiStorageService,
  ContextIntelligenceService,
  ContextCompressionService,
  AdvancedPromptService,
  PromptQualityService,
  ReadmeUpdateService,
  ReadmePromptOptimizationService,
  WikiSummarizationService,
  ReadmeStateDetectionService,
  ReadmeContentAnalysisService,
  ReadmeBackupService,
  ReadmeFileService,
  ReadmePromptBuilderService,
  ReadmeDiffService,
  ReadmeCacheService,
  ReadmeSyncTrackerService,
  ContextSuggestionService,
} from "./";
import { ComplexityCalculationService } from "./services/context/ComplexityCalculationService";
import { PatternExtractionService } from "./services/context/PatternExtractionService";
import { StructureAnalysisService } from "./services/context/StructureAnalysisService";
import { RelationshipAnalysisService } from "./services/context/RelationshipAnalysisService";
import { ProjectTypeDetectionService } from "./services/context/ProjectTypeDetectionService";
import { FileRelevanceAnalysisService } from "./services/context/FileRelevanceAnalysisService";
import { FileRelevanceBatchService } from "./services/context/FileRelevanceBatchService";
import { DependencyAnalysisService } from "./services/context/DependencyAnalysisService";
import { TextUsageSearchService } from "./services/context/TextUsageSearchService";
import { ProjectOverviewService } from "./services/context/ProjectOverviewService";
import { FileSelectionService } from "./services/context/FileSelectionService";
import { CodeExtractionService } from "./services/context/CodeExtractionService";
import {
  VSCodeApiKeyRepository,
  VSCodeConfigurationRepository,
  ErrorHandlerImpl,
  ErrorLoggingService,
  ErrorRecoveryService,
  CachingService,
  PerformanceMonitorService,
  ConfigurationBackupService,
  ProviderHealthService,
  ProviderPerformanceService,
  GenerationCacheService,
  RequestBatchingService,
  DebouncingService,
  BackgroundProcessingService,
  MemoryOptimizationService,
  ProviderValidationService,
  ProjectIndexService,
  type ValidationResult,
  ProjectContextCacheService,
  ProjectContextValidationService,
  ProjectContextCacheInvalidationService,
  WorkspaceStructureCacheService,
  WikiWatcherService,
  LanguageServerIntegrationService,
  GitChangeDetectionService,
  VSCodeDiffService,
  VSCodeFileSystemService,
} from "../infrastructure";
import { MetricsCollectionService } from "../infrastructure/services/performance/MetricsCollectionService";
import { StatisticsCalculationService } from "../infrastructure/services/performance/StatisticsCalculationService";
import { PerformanceMonitoringService } from "../infrastructure/services/performance/PerformanceMonitoringService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import { ExtensionContextStorageService } from "../infrastructure/services/ExtensionContextStorageService";
import { LLMRegistry } from "../llm";
import { CommandFactory } from "../factories";
import { EventBusImpl, SelectionEventHandler, WikiEventHandler, type EventBus } from "../events";
import { OutboundEvents } from "../constants";
import type { ExtensionContext, Webview } from "vscode";
import {
  createGoogleAIStudioValidationRules,
  createZAIValidationRules,
  createOpenRouterValidationRules,
  createCohereValidationRules,
  createHuggingFaceValidationRules,
  createCommonValidationRules,
} from "./validation/ProviderValidationRules";

export class AppBootstrap {
  private container = new Container();
  private loggingService!: LoggingService;
  private logger!: Logger;
  private readinessManager: ServiceReadinessManager;
  private criticalInitPromise: Promise<void>;
  private backgroundInitPromise: Promise<void>;

  constructor(private context: ExtensionContext) {
    this.readinessManager = new ServiceReadinessManager();
    this.registerServiceTiers();
    this.registerServices();
    this.criticalInitPromise = this.initializeCriticalServices();
    this.backgroundInitPromise = this.initializeBackgroundServices();
  }

  /**
   * Register service tiers and command requirements
   */
  private registerServiceTiers(): void {
    // Register services with their tiers
    for (const [serviceId, config] of Object.entries(SERVICE_TIERS)) {
      this.readinessManager.registerService(serviceId, config.tier, []);
    }

    // Register command requirements
    for (const requirement of COMMAND_REQUIREMENTS) {
      this.readinessManager.registerCommandRequirements(requirement);
    }
  }

  /**
   * Initialize only critical services (< 500ms)
   * - LoggingService
   * - EventBus
   * - ConfigurationManager (with cached provider)
   * - MessageBus (registered but not instantiated yet)
   * - CommandRegistry (registered but not instantiated yet)
   */
  private async initializeCriticalServices(): Promise<void> {
    const startTime = Date.now();
    this.logger.info("Starting critical services initialization");

    try {
      // LoggingService and EventBus are already initialized in registerServices
      this.readinessManager.markReady("loggingService");
      this.readinessManager.markReady("eventBus");

      // Initialize ConfigurationManager
      this.readinessManager.markInitializing("configurationManager");
      const configManager = this.container.resolve(
        "configurationManager",
      ) as ConfigurationManagerService;

      // Load cached provider synchronously
      await configManager.loadCachedProvider();

      const cachingService = this.container.resolve("cachingService") as CachingService;
      const generationCacheService = this.container.resolve(
        "generationCacheService",
      ) as GenerationCacheService;

      // Set up basic config without waiting for heavy services
      const cacheInvalidationService = this.container.resolve(
        "projectContextCacheInvalidationService",
      ) as ProjectContextCacheInvalidationService;

      // Don't await projectIndexService here - it will be initialized in background
      configManager.setCacheServicesSync(
        cacheInvalidationService,
        cachingService,
        generationCacheService,
      );

      // Initialize config manager (loads settings, not heavy)
      await configManager.initialize();

      // Run migration if needed
      const migrationService = this.container.resolve(
        "configurationMigrationService",
      ) as ConfigurationMigrationService;
      if (await migrationService.needsMigration()) {
        await migrationService.migrateToVersion("1.4.0");
      }

      this.readinessManager.markReady("configurationManager");

      // MessageBus and CommandRegistry are marked ready when created in createCommandRegistry
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

  /**
   * Initialize background services (don't block UI)
   * - ProjectIndexService
   * - ProviderHealthService
   * - ContextIntelligenceService
   */
  private async initializeBackgroundServices(): Promise<void> {
    // Wait for critical services first
    await this.criticalInitPromise;

    this.logger.info("Starting background services initialization");

    // Initialize in parallel, track progress
    const backgroundTasks = [
      this.initProjectIndexService(),
      this.initProviderHealthService(),
      this.initContextIntelligenceService(),
    ];

    // Track progress
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

    // Don't await - let them complete in background
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

      // Quick init first (load from cache)
      await projectIndexService.quickInit();

      // Then full scan in background
      projectIndexService
        .initialize()
        .then(() => {
          const duration = Date.now() - startTime;
          this.readinessManager.markReady("projectIndexService", { initDuration: duration });
          this.logger.info("ProjectIndexService fully initialized", { duration });
        })
        .catch((err) => {
          this.readinessManager.markFailed("projectIndexService", err);
          this.logger.error("Failed to initialize project index", err);
        });

      // Mark as ready after quick init so commands can use cached data
      const quickDuration = Date.now() - startTime;
      this.readinessManager.markReady("projectIndexService", { initDuration: quickDuration });

      // Set up cache invalidation
      const cacheInvalidationService = this.container.resolve(
        "projectContextCacheInvalidationService",
      ) as ProjectContextCacheInvalidationService;
      cacheInvalidationService.startWatching();

      // Set up wiki watcher
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

      // Just resolve it to ensure it's ready
      await this.container.resolveLazy("contextIntelligenceService");

      // Set up memory optimization
      const memoryOptimizationService = this.container.resolve(
        "memoryOptimizationService",
      ) as MemoryOptimizationService;
      memoryOptimizationService.setMemoryLimit(512 * 1024 * 1024);
      memoryOptimizationService.scheduleCleanup(60000);
      memoryOptimizationService.enableLeakDetection(true);

      // Set up background processing
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

  /**
   * Legacy initialize method for backward compatibility
   * Now just waits for critical services
   */
  async initialize(): Promise<void> {
    await this.criticalInitPromise;
  }

  /**
   * Get promise that resolves when critical services are ready
   */
  getCriticalInitPromise(): Promise<void> {
    return this.criticalInitPromise;
  }

  /**
   * Get promise that resolves when all background services are ready
   */
  getBackgroundInitPromise(): Promise<void> {
    return this.backgroundInitPromise;
  }

  /**
   * Get readiness manager for command execution checks
   */
  getReadinessManager(): ServiceReadinessManager {
    return this.readinessManager;
  }

  private async registerServices(): Promise<void> {
    const loggingService = new LoggingService();
    LoggingService.setInstance(loggingService);
    this.loggingService = loggingService;
    this.logger = createLogger("AppBootstrap");
    this.container.registerInstance("loggingService", loggingService);
    this.container.registerInstance(
      "vscodeFileSystemService",
      new VSCodeFileSystemService(loggingService),
    );

    const eventBus = new EventBusImpl(loggingService);
    this.container.registerInstance("eventBus", eventBus);
    this.container.registerInstance("context", this.context);
    this.container.registerInstance("secrets", this.context.secrets);

    this.container.registerInstance(
      "extensionContextStorageService",
      new ExtensionContextStorageService(this.context, loggingService),
    );
    this.container.registerInstance("cachingService", new CachingService());
    this.container.registerInstance("performanceMonitor", new PerformanceMonitorService());
    this.container.registerInstance(
      "generationCacheService",
      new GenerationCacheService(this.container.resolve("cachingService") as CachingService),
    );
    this.container.registerInstance(
      "requestBatchingService",
      new RequestBatchingService(loggingService),
    );
    this.container.registerInstance("debouncingService", new DebouncingService());
    this.container.registerInstance(
      "backgroundProcessingService",
      new BackgroundProcessingService(),
    );
    this.container.registerInstance("memoryOptimizationService", new MemoryOptimizationService());

    this.container.register(
      "apiKeyRepository",
      () =>
        new VSCodeApiKeyRepository(this.container.resolve("secrets") as any, this.loggingService),
    );

    this.container.register("configurationRepository", () => new VSCodeConfigurationRepository());

    this.container.register(
      "configurationManager",
      () =>
        new ConfigurationManagerService(
          this.container.resolve("configurationRepository"),
          this.container.resolve("eventBus"),
          this.container.resolve("configurationValidationEngine"),
          this.container.resolve("configurationTemplateService"),
          this.container.resolve("configurationImportExportService"),
          this.context,
          this.loggingService,
        ),
    );

    this.container.register("configurationValidationEngine", () => {
      const engine = new ConfigurationValidationEngineService();
      this.initializeValidationRules(engine);
      return engine;
    });

    this.container.register("configurationValidator", () =>
      this.container.resolve("configurationValidationEngine"),
    );

    this.container.register(
      "configurationImportExportService",
      () =>
        new ConfigurationImportExportService(
          this.container.resolve("configurationValidationEngine"),
        ),
    );

    this.container.register(
      "configurationMigrationService",
      () =>
        new ConfigurationMigrationService(
          this.container.resolve("configurationRepository"),
          this.container.resolve("eventBus"),
        ),
    );

    this.container.register(
      "configurationTemplateService",
      () =>
        new ConfigurationTemplateService(this.container.resolve("configurationValidationEngine")),
    );

    this.container.register(
      "configurationBackupService",
      () =>
        new ConfigurationBackupService(
          this.container.resolve("configurationRepository"),
          this.container.resolve("eventBus"),
        ),
    );

    this.container.register("selectionService", () => new SelectionService());

    this.container.register(
      "textUsageSearchService",
      () => new TextUsageSearchService(this.loggingService),
    );

    this.container.register(
      "projectOverviewService",
      () => new ProjectOverviewService(this.loggingService),
    );

    this.container.registerLazy("projectContextService", async () => {
      return new ProjectContextService(
        this.loggingService,
        (await this.container.resolveLazy("projectIndexService")) as ProjectIndexService,
        this.container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
        this.container.resolve("textUsageSearchService") as TextUsageSearchService,
        this.container.resolve("projectOverviewService") as ProjectOverviewService,
      );
    });
    this.container.register(
      "projectContextCacheService",
      () => new ProjectContextCacheService(this.context, this.loggingService, false),
    );

    this.container.register(
      "workspaceStructureCacheService",
      () => new WorkspaceStructureCacheService(this.context, this.loggingService, false),
    );

    this.container.register(
      "projectContextValidationService",
      () => new ProjectContextValidationService(this.loggingService),
    );

    this.container.register(
      "projectContextCacheInvalidationService",
      () =>
        new ProjectContextCacheInvalidationService(
          this.container.resolve("projectContextCacheService") as ProjectContextCacheService,
          this.container.resolve(
            "workspaceStructureCacheService",
          ) as WorkspaceStructureCacheService,
          this.loggingService,
          this.container.resolve("debouncingService") as DebouncingService,
        ),
    );

    this.container.registerLazy("cachedProjectContextService", async () => {
      return new CachedProjectContextService(
        this.container.resolve("cachingService"),
        this.container.resolve("projectContextCacheService") as ProjectContextCacheService,
        this.container.resolve(
          "projectContextValidationService",
        ) as ProjectContextValidationService,
        this.container.resolve("performanceMonitor"),
        (await this.container.resolveLazy("projectContextService")) as ProjectContextService,
        this.loggingService,
      );
    });

    this.container.registerLazy("llmRegistry", async () => {
      const configurationRepository = this.container.resolve(
        "configurationRepository",
      ) as import("../domain/repositories/ConfigurationRepository").ConfigurationRepository;
      const getSetting = async (key: string) => await configurationRepository.get<string>(key);
      return new LLMRegistry(
        this.container.resolve("secrets"),
        this.container.resolve("errorRecoveryService"),
        this.container.resolve("errorLoggingService"),
        this.container.resolve("configurationManager"),
        getSetting,
      );
    });

    this.container.registerLazy(
      "wikiService",
      async () =>
        new WikiService(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("generationCacheService") as GenerationCacheService,
          this.container.resolve("requestBatchingService") as RequestBatchingService,
          this.container.resolve("debouncingService") as DebouncingService,
          this.container.resolve("backgroundProcessingService") as BackgroundProcessingService,
          this.container.resolve("memoryOptimizationService") as MemoryOptimizationService,
          (await this.container.resolveLazy(
            "contextIntelligenceService",
          )) as ContextIntelligenceService,
          this.container.resolve("contextCompressionService") as ContextCompressionService,
          (await this.container.resolveLazy("advancedPromptService")) as AdvancedPromptService,
          this.container.resolve("performanceMonitor") as PerformanceMonitorService,
          (await this.container.resolveLazy(
            "cachedProjectContextService",
          )) as CachedProjectContextService,
          this.loggingService,
          (await this.container.resolveLazy(
            "languageServerIntegrationService",
          )) as LanguageServerIntegrationService,
        ),
    );

    this.container.registerLazy(
      "cachedWikiService",
      async () =>
        new CachedWikiService(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("cachingService"),
          this.container.resolve("performanceMonitor"),
          this.container.resolve("generationCacheService") as GenerationCacheService,
          this.container.resolve("requestBatchingService") as RequestBatchingService,
          this.container.resolve("debouncingService") as DebouncingService,
          this.container.resolve("backgroundProcessingService") as BackgroundProcessingService,
          this.container.resolve("memoryOptimizationService") as MemoryOptimizationService,
        ),
    );

    this.container.register("commandRegistry", () => new CommandRegistry(this.loggingService));

    this.container.register(
      "errorHandler",
      () => new ErrorHandlerImpl(this.container.resolve("eventBus"), this.loggingService),
    );

    this.container.register(
      "errorLoggingService",
      () => new ErrorLoggingService(this.loggingService),
    );

    this.container.register(
      "errorRecoveryService",
      () =>
        new ErrorRecoveryService(
          this.container.resolve("eventBus"),
          this.container.resolve("memoryOptimizationService") as MemoryOptimizationService,
          this.loggingService,
        ),
    );

    this.container.registerLazy(
      "providerSelectionService",
      async () =>
        new ProviderSelectionService(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("eventBus"),
          (await this.container.resolveLazy("contextAnalysisService")) as ContextAnalysisService,
          await this.container.resolveLazy("providerHealthService"),
          this.loggingService,
        ),
    );

    this.container.registerLazy(
      "providerHealthService",
      async () =>
        new ProviderHealthService(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("eventBus"),
          this.loggingService,
        ),
    );

    this.container.registerLazy(
      "providerValidationService",
      async () =>
        new ProviderValidationService(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("configurationManager"),
          this.container.resolve("apiKeyRepository"),
          this.loggingService,
        ),
    );

    this.container.registerLazy("projectIndexService", async () => {
      const service = new ProjectIndexService(
        this.context,
        this.loggingService,
        this.container.resolve("debouncingService") as DebouncingService,
        this.container.resolve("gitChangeDetectionService") as GitChangeDetectionService,
      );
      await service.initialize();
      return service;
    });

    this.container.registerLazy("languageServerIntegrationService", async () => {
      return new LanguageServerIntegrationService(
        this.loggingService,
        this.container.resolve("eventBus"),
        this.container.resolve("debouncingService") as DebouncingService,
        this.container.resolve("cachingService") as CachingService,
      );
    });

    this.container.register(
      "gitChangeDetectionService",
      () =>
        new GitChangeDetectionService(
          this.loggingService,
          this.container.resolve("eventBus"),
          this.context,
        ),
    );

    this.container.registerLazy("providerPerformanceService", async () => {
      const metricsCollectionService = new MetricsCollectionService(
        this.container.resolve("eventBus"),
        this.loggingService,
      );
      const statisticsCalculationService = new StatisticsCalculationService(
        await this.container.resolveLazy("llmRegistry"),
        this.loggingService,
      );
      const performanceMonitoringService = new PerformanceMonitoringService(
        this.container.resolve("eventBus"),
        this.loggingService,
      );

      return new ProviderPerformanceService(
        await this.container.resolveLazy("llmRegistry"),
        this.container.resolve("eventBus"),
        metricsCollectionService,
        statisticsCalculationService,
        performanceMonitoringService,
        this.loggingService,
      );
    });

    this.container.register(
      "selectionEventHandler",
      () => new SelectionEventHandler(this.container.resolve("eventBus")),
    );

    this.container.registerLazy(
      "wikiEventHandler",
      async () =>
        new WikiEventHandler(
          this.container.resolve("eventBus"),
          await this.container.resolveLazy("wikiService"),
          (await this.container.resolveLazy("projectContextService")) as ProjectContextService,
          this.container.resolve("errorRecoveryService"),
          this.container.resolve("errorLoggingService"),
          await this.container.resolveLazy("providerValidationService"),
          this.loggingService,
        ),
    );

    this.container.register(
      "wikiStorageService",
      () =>
        new WikiStorageService(
          this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
          this.loggingService,
        ),
    );

    this.container.register(
      "wikiWatcherService",
      () =>
        new WikiWatcherService(
          this.container.resolve("eventBus"),
          this.context,
          this.loggingService,
          this.container.resolve("debouncingService") as DebouncingService,
          this.container.resolve("gitChangeDetectionService") as
            | import("../infrastructure/services/GitChangeDetectionService").GitChangeDetectionService
            | undefined,
        ),
    );

    this.container.register(
      "patternExtractionService",
      () => new PatternExtractionService(this.loggingService),
    );

    this.container.register(
      "structureAnalysisService",
      () =>
        new StructureAnalysisService(
          this.loggingService,
          this.container.resolve("patternExtractionService") as PatternExtractionService,
        ),
    );

    this.container.register(
      "relationshipAnalysisService",
      () => new RelationshipAnalysisService(this.loggingService),
    );

    this.container.register(
      "complexityCalculationService",
      () => new ComplexityCalculationService(this.loggingService),
    );

    this.container.registerLazy("contextAnalysisService", async () => {
      return new ContextAnalysisService(
        this.container.resolve("eventBus"),
        this.loggingService,
        this.container.resolve("complexityCalculationService") as ComplexityCalculationService,
        this.container.resolve("patternExtractionService") as PatternExtractionService,
        this.container.resolve("structureAnalysisService") as StructureAnalysisService,
        this.container.resolve("relationshipAnalysisService") as RelationshipAnalysisService,
      );
    });

    this.container.registerLazy("projectTypeDetectionService", async () => {
      return new ProjectTypeDetectionService(
        this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        this.container.resolve("cachingService") as CachingService,
        this.container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
        this.loggingService,
      );
    });

    this.container.registerLazy("dependencyAnalysisService", async () => {
      return new DependencyAnalysisService(
        this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        this.container.resolve("cachingService") as CachingService,
        this.container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
        this.loggingService,
      );
    });

    this.container.registerLazy("fileRelevanceAnalysisService", async () => {
      return new FileRelevanceAnalysisService(
        this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        this.container.resolve("cachingService") as CachingService,
        this.container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
        (await this.container.resolveLazy(
          "dependencyAnalysisService",
        )) as DependencyAnalysisService,
        this.loggingService,
      );
    });

    this.container.registerLazy("fileRelevanceBatchService", async () => {
      return new FileRelevanceBatchService(
        this.container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
        (await this.container.resolveLazy(
          "fileRelevanceAnalysisService",
        )) as FileRelevanceAnalysisService,
        this.loggingService,
      );
    });

    this.container.register(
      "fileSelectionService",
      () => new FileSelectionService(this.loggingService),
    );

    this.container.register(
      "codeExtractionService",
      () => new CodeExtractionService(this.loggingService),
    );

    this.container.register(
      "contextSuggestionService",
      () => new ContextSuggestionService(this.loggingService),
    );

    this.container.registerLazy(
      "contextIntelligenceService",
      async () =>
        new ContextIntelligenceService(
          (await this.container.resolveLazy("contextAnalysisService")) as ContextAnalysisService,
          (await this.container.resolveLazy(
            "cachedProjectContextService",
          )) as CachedProjectContextService,
          await this.container.resolveLazy("providerSelectionService"),
          (await this.container.resolveLazy(
            "projectTypeDetectionService",
          )) as ProjectTypeDetectionService,
          (await this.container.resolveLazy(
            "fileRelevanceAnalysisService",
          )) as FileRelevanceAnalysisService,
          (await this.container.resolveLazy(
            "fileRelevanceBatchService",
          )) as FileRelevanceBatchService,
          this.container.resolve("fileSelectionService") as FileSelectionService,
          this.container.resolve("cachingService") as CachingService,
          this.container.resolve(
            "workspaceStructureCacheService",
          ) as WorkspaceStructureCacheService,
          this.container.resolve("performanceMonitor") as PerformanceMonitorService,
          this.container.resolve("eventBus"),
          this.loggingService,
          await this.container.resolveLazy("llmRegistry"),
          (await this.container.resolveLazy("projectIndexService")) as ProjectIndexService,
          this.container.resolve("contextSuggestionService") as ContextSuggestionService,
        ),
    );

    this.container.register(
      "contextCompressionService",
      () => new ContextCompressionService(this.loggingService),
    );

    this.container.registerLazy("advancedPromptService", async () => {
      return new AdvancedPromptService(
        this.loggingService,
        (await this.container.resolveLazy("contextAnalysisService")) as ContextAnalysisService,
        this.container.resolve("eventBus"),
      );
    });

    this.container.register(
      "promptQualityService",
      () => new PromptQualityService(this.loggingService, this.container.resolve("eventBus")),
    );

    this.container.registerLazy(
      "readmePromptOptimizationService",
      async () =>
        new ReadmePromptOptimizationService(
          await this.container.resolveLazy("llmRegistry"),
          this.loggingService,
        ),
    );

    this.container.register(
      "wikiSummarizationService",
      () => new WikiSummarizationService(this.loggingService),
    );

    this.container.register(
      "readmeContentAnalysisService",
      () => new ReadmeContentAnalysisService(this.loggingService),
    );

    this.container.register(
      "readmeStateDetectionService",
      () =>
        new ReadmeStateDetectionService(
          this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
          this.container.resolve("gitChangeDetectionService") as GitChangeDetectionService,
          this.loggingService,
        ),
    );

    this.container.register(
      "readmeBackupService",
      () =>
        new ReadmeBackupService(
          this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
          this.loggingService,
          this.container.resolve("eventBus"),
        ),
    );

    this.container.register(
      "readmeFileService",
      () =>
        new ReadmeFileService(
          this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
          this.loggingService,
        ),
    );

    this.container.registerLazy("readmePromptBuilderService", async () => {
      return new ReadmePromptBuilderService(
        this.container.resolve("wikiSummarizationService") as WikiSummarizationService,
        (await this.container.resolveLazy("projectContextService")) as ProjectContextService,
        (await this.container.resolveLazy(
          "projectTypeDetectionService",
        )) as ProjectTypeDetectionService,
        this.loggingService,
      );
    });

    this.container.register("readmeDiffService", () => new ReadmeDiffService(this.loggingService));

    this.container.register(
      "readmeSyncTrackerService",
      () =>
        new ReadmeSyncTrackerService(
          this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
          this.loggingService,
        ),
    );

    this.container.register("vscodeDiffService", () => new VSCodeDiffService(this.loggingService));

    this.container.register(
      "readmeCacheService",
      () =>
        new ReadmeCacheService(
          this.container.resolve("cachingService") as CachingService,
          this.loggingService,
        ),
    );

    this.container.registerLazy(
      "readmeUpdateService",
      async () =>
        new ReadmeUpdateService(
          this.container.resolve("wikiStorageService") as WikiStorageService,
          await this.container.resolveLazy("llmRegistry"),
          (await this.container.resolveLazy(
            "readmePromptOptimizationService",
          )) as ReadmePromptOptimizationService,
          (await this.container.resolveLazy(
            "readmePromptBuilderService",
          )) as ReadmePromptBuilderService,
          this.container.resolve("readmeStateDetectionService") as ReadmeStateDetectionService,
          this.container.resolve("readmeContentAnalysisService") as ReadmeContentAnalysisService,
          this.container.resolve("readmeBackupService") as ReadmeBackupService,
          this.container.resolve("readmeFileService") as ReadmeFileService,
          this.container.resolve("readmeDiffService") as ReadmeDiffService,
          this.container.resolve("vscodeDiffService") as VSCodeDiffService,
          this.container.resolve("readmeCacheService") as ReadmeCacheService,
          this.container.resolve("readmeSyncTrackerService") as ReadmeSyncTrackerService,
          this.container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
          this.container.resolve("eventBus"),
        ),
    );
  }

  async initializeEventHandlers(): Promise<void> {
    this.container.resolve<SelectionEventHandler>("selectionEventHandler").register();
    const wikiEventHandler = await this.container.resolveLazy<WikiEventHandler>("wikiEventHandler");
    wikiEventHandler.register();

    const errorHandler = this.container.resolve("errorHandler") as ErrorHandlerImpl;
    errorHandler.registerGlobalHandlers();
  }

  async createCommandRegistry(webview: Webview): Promise<CommandRegistry> {
    const commandRegistry = new CommandRegistry(this.loggingService);
    const eventBus = this.container.resolve<EventBus>("eventBus");

    const commandFactory = new CommandFactory({
      container: this.container,
      webview,
      eventBus,
    });

    const commands = await commandFactory.createAllCommands();

    for (const [commandId, command] of Object.entries(commands)) {
      commandRegistry.register(commandId, command);
    }

    const messageBus = new MessageBusService(webview, this.loggingService);
    this.container.registerInstance("messageBus", messageBus);

    commandRegistry.addDisposer(() => {
      try {
        messageBus.dispose();
      } catch (err) {
        this.logger.error("MessageBusService dispose failed", err);
      }
    });

    const unsubSelection = eventBus.subscribe(OutboundEvents.selection, (payload) => {
      messageBus.postSuccess(OutboundEvents.selection, payload);
    });
    commandRegistry.addDisposer(unsubSelection);

    const unsubWikiResult = eventBus.subscribe(OutboundEvents.wikiResult, (payload) => {
      messageBus.postSuccess(OutboundEvents.wikiResult, payload);
    });
    commandRegistry.addDisposer(unsubWikiResult);

    const unsubRelated = eventBus.subscribe(OutboundEvents.related, (payload) => {
      messageBus.postSuccess(OutboundEvents.related, payload);
    });
    commandRegistry.addDisposer(unsubRelated);

    const unsubLoading = eventBus.subscribe(OutboundEvents.loadingStep, (payload) => {
      messageBus.postSuccess(OutboundEvents.loadingStep, payload);
    });

    const unsubReadmeProgress = eventBus.subscribe(
      OutboundEvents.readmeUpdateProgress,
      (payload: { step: string; percent?: number }) => {
        messageBus.postMessage(OutboundEvents.loadingStep, {
          context: "readmeUpdate",
          step: payload.step,
          percent: payload.percent,
        });
      },
    );
    commandRegistry.addDisposer(unsubReadmeProgress);
    commandRegistry.addDisposer(unsubLoading);

    const unsubError = eventBus.subscribe(OutboundEvents.error, (payload: any) => {
      this.logger.info("Error event received in AppBootstrap, forwarding to MessageBus", {
        code: payload.code,
        message: payload.message,
        hasSuggestion:
          !!payload.suggestion || !!(payload.suggestions && payload.suggestions.length > 0),
        hasContext: !!payload.context,
        hasOriginalError: !!payload.originalError,
        timestamp: payload.timestamp,
      });
      const suggestion =
        payload.suggestions && payload.suggestions.length > 0
          ? payload.suggestions[0]
          : payload.suggestion;
      messageBus.postError(
        payload.message,
        payload.code,
        suggestion,
        payload.context,
        payload.originalError,
      );
      this.logger.debug("Error forwarded to MessageBus.postError");
    });
    commandRegistry.addDisposer(unsubError);

    const unsubGenerationCancelled = eventBus.subscribe(OutboundEvents.generationCancelled, () => {
      messageBus.postImmediate(OutboundEvents.generationCancelled, {});
    });
    commandRegistry.addDisposer(unsubGenerationCancelled);

    const unsubReadmeBackupCreated = eventBus.subscribe(
      OutboundEvents.readmeBackupCreated,
      (payload) => {
        messageBus.postImmediate(OutboundEvents.readmeBackupCreated, payload);
      },
    );
    commandRegistry.addDisposer(unsubReadmeBackupCreated);

    const unsubReadmeBackupDeleted = eventBus.subscribe(
      OutboundEvents.readmeBackupDeleted,
      (payload) => {
        messageBus.postImmediate(OutboundEvents.readmeBackupDeleted, payload);
      },
    );
    commandRegistry.addDisposer(unsubReadmeBackupDeleted);

    return commandRegistry;
  }

  getContainer(): Container {
    return this.container;
  }

  getErrorHandler() {
    return this.container.resolve("errorHandler");
  }

  private initializeValidationRules(engine: ConfigurationValidationEngineService): void {
    engine.addProviderValidationRules("google-ai-studio", createGoogleAIStudioValidationRules());
    engine.addProviderValidationRules("zai", createZAIValidationRules());
    engine.addProviderValidationRules("openrouter", createOpenRouterValidationRules());
    engine.addProviderValidationRules("cohere", createCohereValidationRules());
    engine.addProviderValidationRules("huggingface", createHuggingFaceValidationRules());

    const commonRules = createCommonValidationRules();
    for (const rule of commonRules) {
      engine.addValidationRule(rule);
    }

    this.logger.debug("Validation rules initialized", {
      providerRules: 5,
      commonRules: commonRules.length,
    });
  }

  async dispose(): Promise<void> {
    try {
      const healthService = (await this.container.resolveLazy(
        "providerHealthService",
      )) as ProviderHealthService;
      if (healthService && typeof healthService.stopHealthMonitoring === "function") {
        healthService.stopHealthMonitoring();
      }
    } catch (error) {
      this.logger.warn("Error stopping health monitoring during disposal", error);
    }

    if (this.readinessManager) {
      this.readinessManager.dispose();
    }

    if (this.loggingService && typeof this.loggingService.dispose === "function") {
      this.loggingService.dispose();
    }

    await this.container.dispose();
  }
}
