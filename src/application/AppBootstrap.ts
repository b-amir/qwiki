import { Container } from "../container/Container";
import {
  CommandRegistry,
  SelectionService,
  ProjectContextService,
  WikiService,
  MessageBus,
} from "./";
import { VSCodeApiKeyRepository, VSCodeConfigurationRepository, ErrorHandlerImpl, ErrorLoggingServiceImpl, ErrorRecoveryServiceImpl } from "../infrastructure";
import { LLMRegistry } from "../llm";
import { CommandFactory, LLMProviderFactory } from "../factories";
import { CommandIds, ConfigurationKeys, Extension } from "../constants";
import { EventBusImpl, SelectionEventHandler, WikiEventHandler, type EventBus } from "../events";
import { OutboundEvents } from "../constants";
import type { ExtensionContext, Webview } from "vscode";
import { workspace } from "vscode";

export class AppBootstrap {
  private container = new Container();

  constructor(private context: ExtensionContext) {
    this.registerServices();
  }

  private registerServices(): void {
    this.container.registerInstance("context", this.context);
    this.container.registerInstance("secrets", this.context.secrets);

    this.container.register(
      "apiKeyRepository",
      () => new VSCodeApiKeyRepository(this.container.resolve("secrets")),
    );

    this.container.register("configurationRepository", () => new VSCodeConfigurationRepository());

    this.container.register("selectionService", () => new SelectionService());

    this.container.register("projectContextService", () => new ProjectContextService());

    this.container.register("llmRegistry", () => {
      const configuration = workspace.getConfiguration(Extension.configurationSection);
      return new LLMRegistry(this.container.resolve("secrets"), {
        zaiBaseUrl: configuration.get<string>(ConfigurationKeys.zaiBaseUrl),
        googleAIEndpoint: configuration.get<string>(ConfigurationKeys.googleAIEndpoint),
      });
    });

    this.container.register(
      "wikiService",
      () => new WikiService(this.container.resolve("llmRegistry")),
    );

    this.container.register("commandRegistry", () => new CommandRegistry());

    this.container.register("eventBus", () => new EventBusImpl());

    this.container.register(
      "errorHandler",
      () => new ErrorHandlerImpl(this.container.resolve("eventBus")),
    );

    this.container.register(
      "errorLoggingService",
      () => new ErrorLoggingServiceImpl(this.container.resolve("eventBus")),
    );

    this.container.register(
      "errorRecoveryService",
      () => new ErrorRecoveryServiceImpl(this.container.resolve("eventBus")),
    );

    this.container.register(
      "selectionEventHandler",
      () => new SelectionEventHandler(this.container.resolve("eventBus")),
    );

    this.container.register(
      "wikiEventHandler",
      () =>
        new WikiEventHandler(
          this.container.resolve("eventBus"),
          this.container.resolve("wikiService"),
          this.container.resolve("projectContextService"),
        ),
    );
  }

  initializeEventHandlers(): void {
    this.container.resolve<SelectionEventHandler>("selectionEventHandler").register();
    this.container.resolve<WikiEventHandler>("wikiEventHandler").register();
    
    const errorHandler = this.container.resolve("errorHandler") as ErrorHandlerImpl;
    errorHandler.registerGlobalHandlers();
  }

  createCommandRegistry(webview: Webview): CommandRegistry {
    const commandRegistry = new CommandRegistry();
    const eventBus = this.container.resolve<EventBus>("eventBus");
    
    const commandFactory = new CommandFactory({
      container: this.container,
      webview,
      eventBus,
    });

    const commands = commandFactory.createAllCommands();
    
    for (const [commandId, command] of Object.entries(commands)) {
      commandRegistry.register(commandId, command);
    }

    const messageBus = new MessageBus(webview);

    eventBus.subscribe("selection", (payload) => {
      messageBus.postSuccess("selection", payload);
    });

    eventBus.subscribe("wikiResult", (payload) => {
      messageBus.postSuccess("wikiResult", payload);
    });

    eventBus.subscribe("related", (payload) => {
      messageBus.postSuccess("related", payload);
    });

    eventBus.subscribe("loadingStep", (payload) => {
      messageBus.postSuccess("loadingStep", payload);
    });

    eventBus.subscribe("error", (payload: any) => {
      messageBus.postError(payload.message, payload.code);
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
