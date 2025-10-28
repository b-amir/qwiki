export interface ConfigurationRepository {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, any>>;
}
