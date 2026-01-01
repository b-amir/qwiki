import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

export abstract class InitializableService {
  private initPromise: Promise<void> | null = null;
  private initialized = false;
  protected abstract logger: Logger;

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug(`${this.constructor.name} already initialized`);
      return;
    }

    if (this.initPromise) {
      this.logger.debug(`${this.constructor.name} initialization in progress, waiting`);
      return this.initPromise;
    }

    this.logger.debug(`${this.constructor.name} starting initialization`);
    this.initPromise = this.doInitialize();

    try {
      await this.initPromise;
      this.initialized = true;
      this.logger.debug(`${this.constructor.name} initialized successfully`);
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  protected abstract doInitialize(): Promise<void>;

  isInitialized(): boolean {
    return this.initialized;
  }

  protected resetInitialization(): void {
    this.initialized = false;
    this.initPromise = null;
  }
}
