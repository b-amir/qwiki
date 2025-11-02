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
    const handlerCount = this.handlers.get(event)!.size;
    this.logger.debug("Event handler subscribed", {
      event,
      handlerCount,
      totalEvents: this.handlers.size,
    });

    return () => {
      this.unsubscribe(event, handler);
    };
  }

  async publish<T>(event: string, payload: T): Promise<void> {
    const startTime = Date.now();
    this.logger.debug("EventBus.publish started", {
      event,
      hasPayload: !!payload,
      payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
    });

    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      this.logger.debug("EventBus.publish: No handlers found for event", {
        event,
        availableEvents: Array.from(this.handlers.keys()),
      });
      return;
    }

    const handlerCount = eventHandlers.size;
    this.logger.debug("EventBus.publish: Found handlers", {
      event,
      handlerCount,
    });

    const promises = Array.from(eventHandlers).map(async (handler, index) => {
      const handlerStart = Date.now();
      try {
        this.logger.debug("EventBus.publish: Executing handler", {
          event,
          handlerIndex: index,
        });
        await handler(payload);
        this.logger.debug("EventBus.publish: Handler completed", {
          event,
          handlerIndex: index,
          duration: Date.now() - handlerStart,
        });
      } catch (error) {
        this.logger.error("Exception in event handler", {
          event,
          handlerIndex: index,
          duration: Date.now() - handlerStart,
          error,
        });
      }
    });

    await Promise.all(promises);
    this.logger.debug("EventBus.publish completed", {
      event,
      handlerCount,
      totalDuration: Date.now() - startTime,
    });
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
