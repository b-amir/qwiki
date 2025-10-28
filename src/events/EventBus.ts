export type EventHandler<T = any> = (payload: T) => void | Promise<void>;

export interface EventBus {
  subscribe<T>(event: string, handler: EventHandler<T>): () => void;
  publish<T>(event: string, payload: T): Promise<void>;
  unsubscribe(event: string, handler: EventHandler): void;
  clear(): void;
}
