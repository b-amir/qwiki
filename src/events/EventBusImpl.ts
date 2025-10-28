import type { EventBus, EventHandler } from "./EventBus";

export class EventBusImpl implements EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

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
        console.error(`Error in event handler for ${event}:`, error);
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
