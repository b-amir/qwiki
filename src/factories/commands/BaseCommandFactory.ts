import type { Command } from "@/application/commands/Command";
import type { Container } from "@/container/Container";
import type { EventBus } from "@/events";
import type { Webview } from "vscode";
import { MessageBusService } from "@/application/services/core/MessageBusService";
import { LoggingService } from "@/infrastructure/services";

export interface CommandFactoryDependencies {
  container: Container;
  webview: Webview;
  eventBus: EventBus;
}

export abstract class BaseCommandFactory {
  protected messageBus: MessageBusService;
  protected loggingService: LoggingService;
  protected container: Container;
  protected eventBus: EventBus;

  constructor(protected dependencies: CommandFactoryDependencies) {
    this.container = dependencies.container;
    this.eventBus = dependencies.eventBus;

    try {
      this.loggingService = this.container.resolve("loggingService") as LoggingService;
    } catch {
      this.loggingService = new LoggingService();
    }

    this.messageBus = new MessageBusService(dependencies.webview, this.loggingService);
  }

  abstract createCommand<T>(commandId: string): Promise<Command<T> | undefined>;
  abstract getSupportedCommands(): string[];
}
