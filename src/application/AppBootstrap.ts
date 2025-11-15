import { Container } from "@/container/Container";
import { ServiceReadinessManager } from "@/infrastructure/services/ServiceReadinessManager";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { CommandFactory } from "@/factories";
import { CommandRegistry } from "@/application/CommandRegistry";
import { MessageBusService } from "@/application/services";
import { SelectionEventHandler } from "@/events/handlers/SelectionEventHandler";
import { WikiEventHandler } from "@/events/handlers/WikiEventHandler";
import { ErrorHandlerImpl, ProviderHealthService } from "@/infrastructure/services";
import { OutboundEvents } from "@/constants";
import type { ExtensionContext, Webview } from "vscode";
import type { EventBus } from "@/events";
import {
  ReadinessCoordinator,
  InitializationOrchestrator,
  registerInfrastructureServices,
  registerCoreServices,
  registerConfigurationServices,
  registerContextServices,
  registerProviderServices,
  registerReadmeServices,
} from "./bootstrap";

export class AppBootstrap {
  private container = new Container();
  private loggingService!: LoggingService;
  private logger!: Logger;
  private readinessManager: ServiceReadinessManager;
  private readinessCoordinator: ReadinessCoordinator;
  private initOrchestrator: InitializationOrchestrator;
  private criticalInitPromise: Promise<void>;
  private backgroundInitPromise: Promise<void>;

  constructor(private context: ExtensionContext) {
    this.readinessManager = new ServiceReadinessManager();
    this.loggingService = this.initializeLogging();
    this.logger = createLogger("AppBootstrap");

    this.readinessCoordinator = new ReadinessCoordinator(
      this.readinessManager,
      this.loggingService,
    );
    this.readinessCoordinator.registerTiers();
    this.readinessCoordinator.registerCommandRequirements();

    this.registerAllServices();

    this.initOrchestrator = new InitializationOrchestrator(
      this.container,
      this.readinessManager,
      this.loggingService,
    );
    this.criticalInitPromise = this.initOrchestrator.initializeCriticalServices();
    this.backgroundInitPromise = this.initOrchestrator.initializeBackgroundServices();
  }

  private initializeLogging(): LoggingService {
    const loggingService = new LoggingService();
    LoggingService.setInstance(loggingService);
    return loggingService;
  }

  private registerAllServices(): void {
    registerInfrastructureServices(this.container, this.context, this.loggingService);
    registerCoreServices(this.container, this.context, this.loggingService);
    registerConfigurationServices(this.container, this.context, this.loggingService);
    registerContextServices(this.container, this.context, this.loggingService);
    registerProviderServices(this.container, this.loggingService);
    registerReadmeServices(this.container, this.loggingService);
  }

  async initialize(): Promise<void> {
    await this.criticalInitPromise;
  }

  getCriticalInitPromise(): Promise<void> {
    return this.criticalInitPromise;
  }

  getBackgroundInitPromise(): Promise<void> {
    return this.backgroundInitPromise;
  }

  getReadinessManager(): ServiceReadinessManager {
    return this.readinessManager;
  }

  async initializeEventHandlers(): Promise<void> {
    this.container.resolve<SelectionEventHandler>("selectionEventHandler").register();
    const wikiEventHandler = await this.container.resolveLazy<WikiEventHandler>("wikiEventHandler");
    wikiEventHandler.register();

    const errorHandler = this.container.resolve("errorHandler") as ErrorHandlerImpl;
    errorHandler.registerGlobalHandlers();
  }

  async createCommandRegistry(webview: Webview): Promise<CommandRegistry> {
    const commandRegistry = new CommandRegistry(this.loggingService, this.readinessManager);
    const eventBus = this.container.resolve<EventBus>("eventBus");

    const commandFactory = new CommandFactory({
      container: this.container,
      webview,
      eventBus,
    });

    const commands = await commandFactory.createAllCommands();

    const { getCommandMetadata } = await import("@/application/commands/CommandMetadata");

    for (const [commandId, command] of Object.entries(commands)) {
      const metadata = getCommandMetadata(commandId);
      commandRegistry.register(commandId, command, metadata);
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

      const unsubWikiContentChunk = eventBus.subscribe(
        OutboundEvents.wikiContentChunk,
        (payload: any) => {
          if (
            payload &&
            typeof payload === "object" &&
            "chunk" in payload &&
            "accumulatedContent" in payload
          ) {
            messageBus.postChunk(payload.chunk as string, payload.accumulatedContent as string);
          } else {
            messageBus.postMessage(OutboundEvents.wikiContentChunk, payload);
          }
        },
      );
    commandRegistry.addDisposer(unsubWikiContentChunk);

    const unsubWikiGenerationComplete = eventBus.subscribe(
      OutboundEvents.wikiGenerationComplete,
      (payload) => {
        messageBus.flushChunksImmediately();
        messageBus.postMessage(OutboundEvents.wikiGenerationComplete, payload);
      },
    );
    commandRegistry.addDisposer(unsubWikiGenerationComplete);

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
