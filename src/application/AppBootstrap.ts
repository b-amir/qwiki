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
  ConfigurationValidatorService,
  ConfigurationMigrationService,
  ConfigurationTemplateService,
  ConfigurationValidationEngineService,
  ConfigurationImportExportService,
  ProviderSelectionService,
  ContextAnalysisService,
} from "./";
import { ComplexityCalculationService } from "./services/context/ComplexityCalculationService";
import { PatternExtractionService } from "./services/context/PatternExtractionService";
import { StructureAnalysisService } from "./services/context/StructureAnalysisService";
import { RelationshipAnalysisService } from "./services/context/RelationshipAnalysisService";
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
} from "../infrastructure";
import { MetricsCollectionService } from "../infrastructure/services/performance/MetricsCollectionService";
import { StatisticsCalculationService } from "../infrastructure/services/performance/StatisticsCalculationService";
import { PerformanceMonitoringService } from "../infrastructure/services/performance/PerformanceMonitoringService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import { LLMRegistry } from "../llm";
import { CommandFactory } from "../factories";
import { EventBusImpl, SelectionEventHandler, WikiEventHandler, type EventBus } from "../events";
import { OutboundEvents } from "../constants";
import type { ExtensionContext, Webview } from "vscode";
import { WikiStorageService } from "./services/WikiStorageService";

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
  }

  private registerServices(): void {
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
    this.container.registerInstance("cacheService", new CachingService());
    this.container.registerInstance("performanceMonitor", new PerformanceMonitorService());
    this.container.registerInstance(
      "generationCacheService",
      new GenerationCacheService(this.container.resolve("cacheService") as CachingService),
    );
    this.container.registerInstance("requestBatchingService", new RequestBatchingService());
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
        ),
    );

    this.container.register("configurationValidator", () => new ConfigurationValidatorService());

    this.container.register(
      "configurationValidationEngine",
      () => new ConfigurationValidationEngineService(),
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
      "projectContextService",
      () => new ProjectContextService(this.loggingService),
    );
    this.container.register(
      "cachedProjectContextService",
      () =>
        new CachedProjectContextService(
          this.container.resolve("cacheService"),
          this.container.resolve("performanceMonitor"),
          this.container.resolve("projectContextService"),
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
        ),
    );

    this.container.registerLazy(
      "cachedWikiService",
      async () =>
        new CachedWikiService(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("cacheService"),
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
          this.loggingService,
        ),
    );

    this.container.register(
      "wikiStorageService",
      () => new WikiStorageService(this.loggingService),
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
      messageBus.postError(payload.message, payload.code, payload.suggestion);
    });
    commandRegistry.addDisposer(unsubError);

    return commandRegistry;
  }

  getContainer(): Container {
    return this.container;
  }

  getErrorHandler() {
    return this.container.resolve("errorHandler");
  }
}
