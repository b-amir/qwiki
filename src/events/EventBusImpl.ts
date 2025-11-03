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

    const importantEvents = new Set(["error", "wikiResult", "generateWiki", "generationCancelled"]);
    if (importantEvents.has(event)) {
      const handlerCount = this.handlers.get(event)!.size;
      this.logger.debug("Event handler subscribed", {
        event,
        handlerCount,
        totalEvents: this.handlers.size,
      });
    }

    return () => {
      this.unsubscribe(event, handler);
    };
  }

  async publish<T>(event: string, payload: T): Promise<void> {
    const startTime = Date.now();
    const eventHandlers = this.handlers.get(event);

    if (!eventHandlers) {
      const importantEvents = new Set(["error", "wikiResult", "generationCancelled"]);
      if (importantEvents.has(event)) {
        this.logger.debug("Event published but no handlers registered", {
          event,
          availableEvents: Array.from(this.handlers.keys()),
        });
      }
      return;
    }

    const importantEvents = new Set(["error", "wikiResult", "generationCancelled", "generateWiki"]);
    const verboseLogging = importantEvents.has(event);

    if (verboseLogging) {
      this.logger.debug("Publishing event", {
        event,
        handlerCount: eventHandlers.size,
      });
    }

    const promises = Array.from(eventHandlers).map(async (handler, index) => {
      const handlerStart = Date.now();
      try {
        await handler(payload);
        if (verboseLogging) {
          this.logger.debug("Event handler completed", {
            event,
            handlerIndex: index,
            duration: Date.now() - handlerStart,
          });
        }
      } catch (error) {
        this.logger.error("Event handler error", {
          event,
          handlerIndex: index,
          duration: Date.now() - handlerStart,
          error,
        });
      }
    });

    await Promise.all(promises);

    if (verboseLogging) {
      const totalDuration = Date.now() - startTime;
      this.logger.debug("Event published", {
        event,
        handlerCount: eventHandlers.size,
        duration: totalDuration,
      });
    }
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
