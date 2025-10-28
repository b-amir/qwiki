import type { ProviderId } from "../../llm/types";

export interface ApiKeyRepository {
  save(providerId: ProviderId, key: string): Promise<void>;
  get(providerId: ProviderId): Promise<string | undefined>;
  delete(providerId: ProviderId): Promise<void>;
  has(providerId: ProviderId): Promise<boolean>;
}
