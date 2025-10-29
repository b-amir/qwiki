import type { SecretStorage } from "vscode";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";

export class VSCodeApiKeyRepository implements ApiKeyRepository {
  constructor(private secrets: SecretStorage) {}

  async save(providerId: string, key: string): Promise<void> {
    await this.secrets.store(this.keyName(providerId), key);
  }

  async get(providerId: string): Promise<string | undefined> {
    return await this.secrets.get(this.keyName(providerId));
  }

  async delete(providerId: string): Promise<void> {
    await this.secrets.delete(this.keyName(providerId));
  }

  async has(providerId: string): Promise<boolean> {
    const key = await this.get(providerId);
    return Boolean(key);
  }

  private keyName(id: string): string {
    return `qwiki:apikey:${id}`;
  }
}
