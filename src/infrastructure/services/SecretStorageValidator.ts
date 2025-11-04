import type { SecretStorage } from "vscode";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export interface SecretStorageAccessPattern {
  operation: "get" | "store" | "delete" | "has";
  providerId: string;
  timestamp: number;
}

export class SecretStorageValidator {
  private logger: Logger;
  private accessPatterns: SecretStorageAccessPattern[] = [];
  private readonly MAX_PATTERNS = 1000;
  private readonly VALID_KEY_PREFIX = "qwiki:apikey:";

  constructor(
    private secretStorage: SecretStorage,
    loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("SecretStorageValidator", loggingService);
  }

  validateKeyName(key: string): boolean {
    if (!key.startsWith(this.VALID_KEY_PREFIX)) {
      this.logger.warn(
        `Invalid secret key format: ${key} (must start with ${this.VALID_KEY_PREFIX})`,
      );
      return false;
    }

    const providerId = key.substring(this.VALID_KEY_PREFIX.length);
    if (!providerId || providerId.trim().length === 0) {
      this.logger.warn(`Invalid secret key: empty provider ID in ${key}`);
      return false;
    }

    if (providerId.includes(":") || providerId.includes("/") || providerId.includes("\\")) {
      this.logger.warn(
        `Invalid secret key: provider ID contains invalid characters: ${providerId}`,
      );
      return false;
    }

    return true;
  }

  async validateStore(providerId: string, key: string): Promise<boolean> {
    const keyName = this.buildKeyName(providerId);
    if (!this.validateKeyName(keyName)) {
      return false;
    }

    if (!key || key.trim().length === 0) {
      this.logger.warn(`Attempted to store empty key for provider ${providerId}`);
      return false;
    }

    this.recordAccess("store", providerId);
    return true;
  }

  async validateGet(providerId: string): Promise<boolean> {
    const keyName = this.buildKeyName(providerId);
    if (!this.validateKeyName(keyName)) {
      return false;
    }

    this.recordAccess("get", providerId);
    return true;
  }

  async validateDelete(providerId: string): Promise<boolean> {
    const keyName = this.buildKeyName(providerId);
    if (!this.validateKeyName(keyName)) {
      return false;
    }

    this.recordAccess("delete", providerId);
    return true;
  }

  async validateHas(providerId: string): Promise<boolean> {
    const keyName = this.buildKeyName(providerId);
    if (!this.validateKeyName(keyName)) {
      return false;
    }

    this.recordAccess("has", providerId);
    return true;
  }

  getAccessPatterns(): SecretStorageAccessPattern[] {
    return [...this.accessPatterns];
  }

  getAccessPatternsForProvider(providerId: string): SecretStorageAccessPattern[] {
    return this.accessPatterns.filter((p) => p.providerId === providerId);
  }

  clearAccessPatterns(): void {
    this.accessPatterns = [];
  }

  private buildKeyName(providerId: string): string {
    return `${this.VALID_KEY_PREFIX}${providerId}`;
  }

  private recordAccess(operation: "get" | "store" | "delete" | "has", providerId: string): void {
    if (this.accessPatterns.length >= this.MAX_PATTERNS) {
      this.accessPatterns.shift();
    }

    this.accessPatterns.push({
      operation,
      providerId,
      timestamp: Date.now(),
    });
  }
}
