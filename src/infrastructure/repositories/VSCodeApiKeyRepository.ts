import type { SecretStorage } from "vscode";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import type { ProviderId } from "../../llm/types";

export class VSCodeApiKeyRepository implements ApiKeyRepository {
  constructor(private secrets: SecretStorage) {}

  async save(providerId: ProviderId, key: string): Promise<void> {
    await this.secrets.store(this.keyName(providerId), key);
  }

  async get(providerId: ProviderId): Promise<string | undefined> {
    return await this.secrets.get(this.keyName(providerId));
  }

  async delete(providerId: ProviderId): Promise<void> {
    await this.secrets.delete(this.keyName(providerId));
  }

  async has(providerId: ProviderId): Promise<boolean> {
    const key = await this.get(providerId);
    return Boolean(key);
  }

  private keyName(id: ProviderId): string {
    return `qwiki:apikey:${id}`;
  }
}
