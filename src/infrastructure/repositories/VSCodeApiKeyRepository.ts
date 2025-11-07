import type { SecretStorage } from "vscode";
import type { ApiKeyRepository } from "../../domain/repositories/ApiKeyRepository";
import { LoggingService, createLogger, type Logger } from "../services/LoggingService";
import { SecretStorageValidator } from "../services/SecretStorageValidator";

export class VSCodeApiKeyRepository implements ApiKeyRepository {
  private logger: Logger;
  private validator: SecretStorageValidator;

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
  }

  async get(providerId: string): Promise<string | undefined> {
    if (!(await this.validator.validateGet(providerId))) {
      throw new Error(`Invalid API key retrieval attempt for provider: ${providerId}`);
    }

    return await this.secrets.get(this.keyName(providerId));
  }

  async delete(providerId: string): Promise<void> {
    if (!(await this.validator.validateDelete(providerId))) {
      throw new Error(`Invalid API key deletion attempt for provider: ${providerId}`);
    }

    await this.secrets.delete(this.keyName(providerId));
  }

  async has(providerId: string): Promise<boolean> {
    if (!(await this.validator.validateHas(providerId))) {
      return false;
    }

    const key = await this.get(providerId);
    return Boolean(key);
  }

  private keyName(id: string): string {
    return `qwiki:apikey:${id}`;
  }
}
