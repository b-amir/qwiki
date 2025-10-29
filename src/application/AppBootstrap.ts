import { Container } from "../container/Container";
import {
  CommandRegistry,
  SelectionService,
  ProjectContextService,
  CachedProjectContextService,
  WikiService,
  CachedWikiService,
  MessageBus,
  ConfigurationManager,
} from "./";
import {
  VSCodeApiKeyRepository,
  VSCodeConfigurationRepository,
  ErrorHandlerImpl,
  ErrorLoggingServiceImpl,
  ErrorRecoveryService,
  CacheService,
  PerformanceMonitor,
} from "../infrastructure";
import { LLMRegistry } from "../llm";
import { CommandFactory } from "../factories";
import { CommandIds, Extension } from "../constants";
import { EventBusImpl, SelectionEventHandler, WikiEventHandler, type EventBus } from "../events";
import { OutboundEvents } from "../constants";
import type { ExtensionContext, Webview } from "vscode";
import { workspace } from "vscode";

export class AppBootstrap {
  private container = new Container();

  constructor(private context: ExtensionContext) {
    this.registerServices();
  }

  async initialize(): Promise<void> {
    const configManager = this.container.resolve("configurationManager") as ConfigurationManager;
    await configManager.initialize();
  }

  private registerServices(): void {
    this.container.registerInstance("context", this.context);
    this.container.registerInstance("secrets", this.context.secrets);
    this.container.registerInstance("cacheService", new CacheService());
    this.container.registerInstance("performanceMonitor", new PerformanceMonitor());

    this.container.register(
      "apiKeyRepository",
      () => new VSCodeApiKeyRepository(this.container.resolve("secrets")),
    );

    this.container.register("configurationRepository", () => new VSCodeConfigurationRepository());

    const configManager = new ConfigurationManager(
      this.container.resolve("configurationRepository"),
    );
    this.container.registerInstance("configurationManager", configManager);

    this.container.register("selectionService", () => new SelectionService());

    this.container.register("projectContextService", () => new ProjectContextService());
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
        getSetting,
      );
    });

    this.container.registerLazy(
      "wikiService",
      async () => new WikiService(await this.container.resolveLazy("llmRegistry")),
    );

    this.container.registerLazy(
      "cachedWikiService",
      async () =>
        new CachedWikiService(
          await this.container.resolveLazy("llmRegistry"),
          this.container.resolve("cacheService"),
          this.container.resolve("performanceMonitor"),
        ),
    );

    this.container.register("commandRegistry", () => new CommandRegistry());

    this.container.registerInstance("eventBus", new EventBusImpl());

    this.container.register(
      "errorHandler",
      () => new ErrorHandlerImpl(this.container.resolve("eventBus")),
    );

    this.container.register(
      "errorLoggingService",
      () => new ErrorLoggingServiceImpl(this.container.resolve("eventBus")),
    );

    this.container.register("errorRecoveryService", () => new ErrorRecoveryService());

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
    const commandRegistry = new CommandRegistry();
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

    const messageBus = new MessageBus(webview);

    eventBus.subscribe(OutboundEvents.selection, (payload) => {
      messageBus.postSuccess(OutboundEvents.selection, payload);
    });

    eventBus.subscribe(OutboundEvents.wikiResult, (payload) => {
      messageBus.postSuccess(OutboundEvents.wikiResult, payload);
    });

    eventBus.subscribe(OutboundEvents.related, (payload) => {
      messageBus.postSuccess(OutboundEvents.related, payload);
    });

    eventBus.subscribe(OutboundEvents.loadingStep, (payload) => {
      messageBus.postSuccess(OutboundEvents.loadingStep, payload);
    });

    eventBus.subscribe(OutboundEvents.error, (payload: any) => {
      messageBus.postError(payload.message, payload.code, payload.suggestion);
    });

    return commandRegistry;
  }

  getContainer(): Container {
    return this.container;
  }

  getErrorHandler() {
    return this.container.resolve("errorHandler");
  }
}
