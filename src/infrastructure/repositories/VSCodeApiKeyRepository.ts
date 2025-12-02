import type { SecretStorage } from "vscode";
import type { ApiKeyRepository } from "@/domain/repositories/ApiKeyRepository";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { SecretStorageValidator } from "@/infrastructure/services/storage/SecretStorageValidator";

export class VSCodeApiKeyRepository implements ApiKeyRepository {
  private logger: Logger;
  private validator: SecretStorageValidator;
  private presenceCache = new Map<string, { hasKey: boolean; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 60000;

  constructor(
    private secrets: SecretStorage,
    loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("VSCodeApiKeyRepository");
    this.validator = new SecretStorageValidator(secrets, loggingService);
  }

  async save(providerId: string, key: string): Promise<void> {
    if (!(await this.validator.validateStore(providerId, key))) {
      throw new Error(`Invalid API key storage attempt for provider: ${providerId}`);
    }

    await this.secrets.store(this.keyName(providerId), key);
    this.presenceCache.set(providerId, { hasKey: true, cachedAt: Date.now() });
  }

  async get(providerId: string): Promise<string | undefined> {
    if (!(await this.validator.validateGet(providerId))) {
      throw new Error(`Invalid API key retrieval attempt for provider: ${providerId}`);
    }

    const key = await this.secrets.get(this.keyName(providerId));
    this.presenceCache.set(providerId, {
      hasKey: Boolean(key),
      cachedAt: Date.now(),
    });
    return key;
  }

  async delete(providerId: string): Promise<void> {
    if (!(await this.validator.validateDelete(providerId))) {
      throw new Error(`Invalid API key deletion attempt for provider: ${providerId}`);
    }

    await this.secrets.delete(this.keyName(providerId));
    this.presenceCache.set(providerId, { hasKey: false, cachedAt: Date.now() });
  }

  async has(providerId: string): Promise<boolean> {
    if (!(await this.validator.validateHas(providerId))) {
      return false;
    }

    const cached = this.presenceCache.get(providerId);
    const now = Date.now();
    if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.hasKey;
    }

    const key = await this.get(providerId);
    const hasKey = Boolean(key);
    this.presenceCache.set(providerId, { hasKey, cachedAt: now });
    return hasKey;
  }

  private keyName(id: string): string {
    return `qwiki:apikey:${id}`;
  }
}
