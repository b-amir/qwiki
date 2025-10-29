export interface ApiKeyRepository {
  save(providerId: string, key: string): Promise<void>;
  get(providerId: string): Promise<string | undefined>;
  delete(providerId: string): Promise<void>;
  has(providerId: string): Promise<boolean>;
}
