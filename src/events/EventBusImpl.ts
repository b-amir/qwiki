import type { EventBus, EventHandler } from "./EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";

export class EventBusImpl implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private logger: Logger;

  constructor(
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("EventBus", loggingService);
  }

  subscribe<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    this.handlers.get(event)!.add(handler);

    return () => {
      this.unsubscribe(event, handler);
    };
  }

  async publish<T>(event: string, payload: T): Promise<void> {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      return;
    }

    const promises = Array.from(eventHandlers).map(async (handler) => {
      try {
        await handler(payload);
      } catch (error) {
        this.logger.error("Exception in event handler", error);
      }
    });

    await Promise.all(promises);
  }

  unsubscribe(event: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
