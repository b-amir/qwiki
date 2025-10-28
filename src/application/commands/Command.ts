export interface Command<T = any> {
  execute(payload: T): Promise<void>;
}
