export interface Command<T = any, R = any> {
  execute(payload: T): Promise<R>;
}
