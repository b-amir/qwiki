import { Container } from "../container/Container";
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

export class AppBootstrap {
  private container = new Container();
  private loggingService!: LoggingService;
  private logger!: Logger;

  constructor(private context: ExtensionContext) {
    this.registerServices();
  }

  async initialize(): Promise<void> {
    const configManager = this.container.resolve(
      "configurationManager",
    ) as ConfigurationManagerService;
    await configManager.initialize();

    const migrationService = this.container.resolve(
      "configurationMigrationService",
    ) as ConfigurationMigrationService;
    if (await migrationService.needsMigration()) {
      await migrationService.migrateToVersion("1.4.0");
    }

    const healthService = (await this.container.resolveLazy(
      "providerHealthService",
    )) as ProviderHealthService;
    healthService.startHealthMonitoring();

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

    const projectIndexService = this.container.resolve(
      "projectIndexService",
    ) as ProjectIndexService;
    projectIndexService.initialize().catch((err) => {
      this.logger.error("Failed to initialize project index", err);
    });

    const cacheInvalidationService = this.container.resolve(
      "projectContextCacheInvalidationService",
    ) as ProjectContextCacheInvalidationService;
    cacheInvalidationService.startWatching();
  }

  private async registerServices(): Promise<void> {
    const loggingService = new LoggingService({
      enabled: true,
      level: "debug",
      includeTimestamp: true,
      includeService: true,
    });
    this.loggingService = loggingService;
    this.logger = createLogger("AppBootstrap", loggingService);
    this.container.registerInstance("loggingService", loggingService);

    this.container.registerInstance("eventBus", new EventBusImpl(loggingService));
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
      () => new VSCodeApiKeyRepository(this.container.resolve("secrets") as any),
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

    this.container.register(
      "configurationValidationEngine",
      () => new ConfigurationValidationEngineService(),
    );

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

    this.container.register(
      "projectContextService",
      () =>
        new ProjectContextService(
          this.loggingService,
          this.container.resolve("projectIndexService") as ProjectIndexService,
          this.container.resolve(
            "workspaceStructureCacheService",
          ) as WorkspaceStructureCacheService,
          this.container.resolve("textUsageSearchService") as TextUsageSearchService,
          this.container.resolve("projectOverviewService") as ProjectOverviewService,
        ),
    );
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

    this.container.register(
      "cachedProjectContextService",
      () =>
        new CachedProjectContextService(
          this.container.resolve("cachingService"),
          this.container.resolve("projectContextCacheService") as ProjectContextCacheService,
          this.container.resolve(
            "projectContextValidationService",
          ) as ProjectContextValidationService,
          this.container.resolve("performanceMonitor"),
          this.container.resolve("projectContextService"),
          this.loggingService,
        ),
    );

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
          this.container.resolve("advancedPromptService") as AdvancedPromptService,
          this.container.resolve("performanceMonitor") as PerformanceMonitorService,
          this.container.resolve("cachedProjectContextService") as CachedProjectContextService,
          this.loggingService,
          this.container.resolve(
            "languageServerIntegrationService",
          ) as LanguageServerIntegrationService,
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

    this.container.register("errorRecoveryService", () => new ErrorRecoveryService());

    this.container.registerLazy(
      "providerSelectionService",
      async () =>
        new ProviderSelectionService(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("eventBus"),
          this.container.resolve("contextAnalysisService") as ContextAnalysisService,
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

    this.container.register(
      "projectIndexService",
      () =>
        new ProjectIndexService(
          this.context,
          this.loggingService,
          this.container.resolve("debouncingService") as DebouncingService,
          this.container.resolve("gitChangeDetectionService") as GitChangeDetectionService,
        ),
    );

    this.container.register(
      "languageServerIntegrationService",
      () =>
        new LanguageServerIntegrationService(
          this.loggingService,
          this.container.resolve("eventBus"),
          this.container.resolve("debouncingService") as DebouncingService,
          this.container.resolve("cachingService") as CachingService,
        ),
    );

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
          this.container.resolve("projectContextService"),
          this.container.resolve("errorRecoveryService"),
          this.container.resolve("errorLoggingService"),
          await this.container.resolveLazy("providerValidationService"),
          this.loggingService,
        ),
    );

    this.container.register(
      "wikiStorageService",
      () => new WikiStorageService(this.loggingService),
    );

    this.container.register(
      "wikiWatcherService",
      () =>
        new WikiWatcherService(
          this.container.resolve("eventBus"),
          this.context,
          this.loggingService,
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

    this.container.register(
      "contextAnalysisService",
      () =>
        new ContextAnalysisService(
          this.container.resolve("eventBus"),
          this.loggingService,
          this.container.resolve("complexityCalculationService") as ComplexityCalculationService,
          this.container.resolve("patternExtractionService") as PatternExtractionService,
          this.container.resolve("structureAnalysisService") as StructureAnalysisService,
          this.container.resolve("relationshipAnalysisService") as RelationshipAnalysisService,
        ),
    );

    this.container.register(
      "projectTypeDetectionService",
      () =>
        new ProjectTypeDetectionService(
          this.container.resolve("cachingService") as CachingService,
          this.container.resolve(
            "workspaceStructureCacheService",
          ) as WorkspaceStructureCacheService,
          this.loggingService,
        ),
    );

    this.container.register(
      "dependencyAnalysisService",
      () =>
        new DependencyAnalysisService(
          this.container.resolve("cachingService") as CachingService,
          this.container.resolve(
            "workspaceStructureCacheService",
          ) as WorkspaceStructureCacheService,
          this.loggingService,
        ),
    );

    this.container.register(
      "fileRelevanceAnalysisService",
      () =>
        new FileRelevanceAnalysisService(
          this.container.resolve("cachingService") as CachingService,
          this.container.resolve(
            "workspaceStructureCacheService",
          ) as WorkspaceStructureCacheService,
          this.container.resolve("dependencyAnalysisService") as DependencyAnalysisService,
          this.loggingService,
        ),
    );

    this.container.register(
      "fileRelevanceBatchService",
      () =>
        new FileRelevanceBatchService(
          this.container.resolve(
            "workspaceStructureCacheService",
          ) as WorkspaceStructureCacheService,
          this.container.resolve("fileRelevanceAnalysisService") as FileRelevanceAnalysisService,
          this.loggingService,
        ),
    );

    this.container.register(
      "fileSelectionService",
      () => new FileSelectionService(this.loggingService),
    );

    this.container.register(
      "codeExtractionService",
      () => new CodeExtractionService(this.loggingService),
    );

    this.container.registerLazy(
      "contextIntelligenceService",
      async () =>
        new ContextIntelligenceService(
          this.container.resolve("contextAnalysisService") as ContextAnalysisService,
          this.container.resolve("cachedProjectContextService") as CachedProjectContextService,
          await this.container.resolveLazy("providerSelectionService"),
          this.container.resolve("projectTypeDetectionService") as ProjectTypeDetectionService,
          this.container.resolve("fileRelevanceAnalysisService") as FileRelevanceAnalysisService,
          this.container.resolve("fileRelevanceBatchService") as FileRelevanceBatchService,
          this.container.resolve("fileSelectionService") as FileSelectionService,
          this.container.resolve("cachingService") as CachingService,
          this.container.resolve(
            "workspaceStructureCacheService",
          ) as WorkspaceStructureCacheService,
          this.container.resolve("performanceMonitor") as PerformanceMonitorService,
          this.container.resolve("eventBus"),
          this.loggingService,
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("projectIndexService") as ProjectIndexService,
        ),
    );

    this.container.register(
      "contextCompressionService",
      () => new ContextCompressionService(this.loggingService),
    );

    this.container.register(
      "advancedPromptService",
      () =>
        new AdvancedPromptService(
          this.loggingService,
          this.container.resolve("contextAnalysisService") as ContextAnalysisService,
          this.container.resolve("eventBus"),
        ),
    );

    this.container.register(
      "promptQualityService",
      () => new PromptQualityService(this.loggingService, this.container.resolve("eventBus")),
    );

    this.container.registerLazy(
      "readmeUpdateService",
      async () =>
        new ReadmeUpdateService(
          this.container.resolve("wikiStorageService") as WikiStorageService,
          await this.container.resolveLazy("llmRegistry"),
          this.loggingService,
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

    return commandRegistry;
  }

  getContainer(): Container {
    return this.container;
  }

  getErrorHandler() {
    return this.container.resolve("errorHandler");
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

    if (this.loggingService && typeof this.loggingService.dispose === "function") {
      this.loggingService.dispose();
    }

    await this.container.dispose();
  }
}
