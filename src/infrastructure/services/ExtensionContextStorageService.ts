import type { ExtensionContext, Memento } from "vscode";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export class ExtensionContextStorageService {
  private logger: Logger;

  constructor(
    private context: ExtensionContext,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ExtensionContextStorageService");
  }

  get globalState(): Memento {
    return this.context.globalState;
  }

  get workspaceState(): Memento {
    return this.context.workspaceState;
  }

  async getGlobal<T>(key: string): Promise<T | undefined> {
    try {
      return this.globalState.get<T>(key);
    } catch (error) {
      this.logger.error(`Failed to get global state for key: ${key}`, error);
      return undefined;
    }
  }

  async setGlobal<T>(key: string, value: T): Promise<void> {
    try {
      await this.globalState.update(key, value);
      this.logger.debug(`Updated global state for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to set global state for key: ${key}`, error);
      throw error;
    }
  }

  async getWorkspace<T>(key: string): Promise<T | undefined> {
    try {
      return this.workspaceState.get<T>(key);
    } catch (error) {
      this.logger.error(`Failed to get workspace state for key: ${key}`, error);
      return undefined;
    }
  }

  async setWorkspace<T>(key: string, value: T): Promise<void> {
    try {
      await this.workspaceState.update(key, value);
      this.logger.debug(`Updated workspace state for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to set workspace state for key: ${key}`, error);
      throw error;
    }
  }

  async getLastUsedProvider(): Promise<string | undefined> {
    return this.getGlobal<string>("lastUsedProvider");
  }

  async setLastUsedProvider(providerId: string): Promise<void> {
    await this.setGlobal("lastUsedProvider", providerId);
  }

  async getUserPreferences(): Promise<Record<string, any> | undefined> {
    return this.getGlobal<Record<string, any>>("userPreferences");
  }

  async setUserPreferences(preferences: Record<string, any>): Promise<void> {
    await this.setGlobal("userPreferences", preferences);
  }
}
