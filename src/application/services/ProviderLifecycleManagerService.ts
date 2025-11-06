import { EventBus } from "../../events/EventBus";
import { ProviderDiscoveryService } from "./ProviderDiscoveryService";
import { LLMProvider } from "../../llm/types";
import { HealthCheckResult } from "../../llm/types/ProviderCapabilities";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export enum ProviderState {
  UNLOADED = "unloaded",
  LOADING = "loading",
  LOADED = "loaded",
  INITIALIZING = "initializing",
  READY = "ready",
  ERROR = "error",
  DISPOSING = "disposing",
}

export class ProviderLifecycleManagerService {
  private activeProviders = new Map<string, LLMProvider>();
  private providerStates = new Map<string, ProviderState>();
  private initializationPromises = new Map<string, Promise<void>>();
  private logger: Logger;

  constructor(
    private providerDiscoveryService: ProviderDiscoveryService,
    private eventBus: EventBus,
    private loggingService: LoggingService = new LoggingService({
      mode: "none",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    this.logger = createLogger("ProviderLifecycleManagerService");
  }

  async initializeProvider(providerId: string): Promise<void> {
    const initStartTime = Date.now();
    this.logger.debug(`Starting initialization for provider ${providerId}`);

    if (this.initializationPromises.has(providerId)) {
      this.logger.debug(
        `Initialization already in progress for provider ${providerId}, returning existing promise`,
      );
      return this.initializationPromises.get(providerId)!;
    }

    const initializationPromise = this._initializeProviderInternal(providerId);
    this.initializationPromises.set(providerId, initializationPromise);

    try {
      await initializationPromise;
      const initEndTime = Date.now();
      this.logger.info(
        `Provider ${providerId} initialized successfully in ${initEndTime - initStartTime}ms`,
      );
    } catch (error) {
      const initEndTime = Date.now();
      this.logger.error(
        `Failed to initialize provider ${providerId} after ${initEndTime - initStartTime}ms`,
        error,
      );
      throw error;
    } finally {
      this.initializationPromises.delete(providerId);
    }
  }

  private async _initializeProviderInternal(providerId: string): Promise<void> {
    const initStartTime = Date.now();
    this.logger.debug(`Starting internal initialization for provider ${providerId}`);

    this.setProviderState(providerId, ProviderState.INITIALIZING);

    try {
      const discoveryStartTime = Date.now();
      this.logger.debug(`Discovering providers for ${providerId}`);

      const discoveredProviders = this.providerDiscoveryService.getDiscoveredProviders();
      const metadata = discoveredProviders.find((p) => p.id === providerId);

      const discoveryEndTime = Date.now();
      this.logger.debug(
        `Provider discovery completed in ${discoveryEndTime - discoveryStartTime}ms`,
      );

      if (!metadata) {
        const error = new Error(`Provider ${providerId} not found in discovered providers`);
        this.logger.error(error.message, error);
        throw error;
      }

      const loadStartTime = Date.now();
      this.logger.debug(`Loading provider ${providerId} from metadata`);

      const provider = await this.providerDiscoveryService.loadProviderFromMetadata(metadata);
      if (!provider) {
        const error = new Error(`Failed to load provider ${providerId}`);
        this.logger.error(error.message, error);
        throw error;
      }

      const loadEndTime = Date.now();
      this.logger.info(`Provider ${providerId} loaded in ${loadEndTime - loadStartTime}ms`);

      this.activeProviders.set(providerId, provider);
      this.setProviderState(providerId, ProviderState.LOADED);

      const providerInitStartTime = Date.now();
      this.logger.debug(`Initializing provider ${providerId}`);

      await provider.initialize();

      const providerInitEndTime = Date.now();
      this.logger.info(
        `Provider ${providerId} initialized in ${providerInitEndTime - providerInitStartTime}ms`,
      );

      this.setProviderState(providerId, ProviderState.READY);

      this.eventBus.publish("provider-initialized", { providerId, provider });

      const initEndTime = Date.now();
      this.logger.info(
        `Provider ${providerId} fully initialized in ${initEndTime - initStartTime}ms`,
      );
    } catch (error) {
      const initEndTime = Date.now();
      this.logger.error(
        `Error initializing provider ${providerId} after ${initEndTime - initStartTime}ms`,
        error,
      );
      this.setProviderState(providerId, ProviderState.ERROR);
      this.eventBus.publish("provider-error", { providerId, error });
      throw error;
    }
  }

  async disposeProvider(providerId: string): Promise<void> {
    const disposeStartTime = Date.now();
    this.logger.debug(`Starting disposal of provider ${providerId}`);

    this.setProviderState(providerId, ProviderState.DISPOSING);

    try {
      const provider = this.activeProviders.get(providerId);
      if (provider) {
        this.logger.debug(`Disposing provider ${providerId}`);
        await provider.dispose();
        this.activeProviders.delete(providerId);
      } else {
        this.logger.warn(`Provider ${providerId} not found in active providers during disposal`);
      }

      this.setProviderState(providerId, ProviderState.UNLOADED);
      this.eventBus.publish("provider-disposed", { providerId });

      const disposeEndTime = Date.now();
      this.logger.info(
        `Provider ${providerId} disposed successfully in ${disposeEndTime - disposeStartTime}ms`,
      );
    } catch (error) {
      const disposeEndTime = Date.now();
      this.logger.error(
        `Error disposing provider ${providerId} after ${disposeEndTime - disposeStartTime}ms`,
        error,
      );
      this.setProviderState(providerId, ProviderState.ERROR);
      this.eventBus.publish("provider-error", { providerId, error });
      throw error;
    }
  }

  async restartProvider(providerId: string): Promise<void> {
    const restartStartTime = Date.now();
    this.logger.debug(`Starting restart of provider ${providerId}`);

    try {
      await this.disposeProvider(providerId);
      await this.initializeProvider(providerId);
      this.eventBus.publish("provider-restarted", { providerId });

      const restartEndTime = Date.now();
      this.logger.info(
        `Provider ${providerId} restarted successfully in ${restartEndTime - restartStartTime}ms`,
      );
    } catch (error) {
      const restartEndTime = Date.now();
      this.logger.error(
        `Failed to restart provider ${providerId} after ${restartEndTime - restartStartTime}ms`,
        error,
      );
      this.eventBus.publish("provider-error", { providerId, error });
      throw error;
    }
  }

  getProviderState(providerId: string): ProviderState {
    return this.providerStates.get(providerId) || ProviderState.UNLOADED;
  }

  getAllProviderStates(): Record<string, ProviderState> {
    const states: Record<string, ProviderState> = {};
    this.providerStates.forEach((state, id) => {
      states[id] = state;
    });
    return states;
  }

  async healthCheckProvider(providerId: string): Promise<HealthCheckResult> {
    const healthCheckStartTime = Date.now();
    this.logger.debug(`Starting health check for provider ${providerId}`);

    const provider = this.activeProviders.get(providerId);
    if (!provider) {
      const errorResult: HealthCheckResult = {
        isHealthy: false,
        responseTime: 0,
        error: `Provider ${providerId} is not active`,
        lastChecked: new Date(),
      };
      this.logger.error(
        `Health check failed for provider ${providerId} - ${errorResult.error}`,
        errorResult,
      );
      return errorResult;
    }

    try {
      const result = await provider.healthCheck();
      const healthCheckEndTime = Date.now();
      const responseTime = healthCheckEndTime - healthCheckStartTime;

      if (result.isHealthy) {
        this.logger.info(`Health check passed for provider ${providerId} in ${responseTime}ms`);
      } else {
        this.logger.warn(
          `Health check failed for provider ${providerId} in ${responseTime}ms: ${result.error}`,
          result,
        );
      }

      this.eventBus.publish("provider-health-checked", { providerId, result });
      return result;
    } catch (error) {
      const healthCheckEndTime = Date.now();
      const responseTime = healthCheckEndTime - healthCheckStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Health check error for provider ${providerId} after ${responseTime}ms`,
        error,
      );

      const errorResult: HealthCheckResult = {
        isHealthy: false,
        responseTime,
        error: errorMessage,
        lastChecked: new Date(),
      };

      this.eventBus.publish("provider-health-check-failed", {
        providerId,
        error: errorResult.error,
      });
      return errorResult;
    }
  }

  getActiveProvider(providerId: string): LLMProvider | null {
    return this.activeProviders.get(providerId) || null;
  }

  getActiveProviders(): LLMProvider[] {
    return Array.from(this.activeProviders.values());
  }

  getReadyProviders(): LLMProvider[] {
    return Array.from(this.activeProviders.entries())
      .filter(([id]) => this.getProviderState(id) === ProviderState.READY)
      .map(([, provider]) => provider);
  }

  private setProviderState(providerId: string, state: ProviderState): void {
    const previousState = this.providerStates.get(providerId);
    this.providerStates.set(providerId, state);

    this.eventBus.publish("provider-state-changed", {
      providerId,
      previousState,
      currentState: state,
    });
  }

  async initializeAllProviders(): Promise<void> {
    const initAllStartTime = Date.now();
    this.logger.debug("Starting initialization of all providers");

    try {
      const discoveredProviders = this.providerDiscoveryService.getDiscoveredProviders();
      this.logger.debug(`Found ${discoveredProviders.length} providers to initialize`);

      const initializationPromises = discoveredProviders.map((provider) =>
        this.initializeProvider(provider.id).catch((error) => {
          this.logger.error(`Failed to initialize provider ${provider.id}`, error);
        }),
      );

      await Promise.allSettled(initializationPromises);

      const initAllEndTime = Date.now();
      this.logger.info(
        `All providers initialization completed in ${initAllEndTime - initAllStartTime}ms`,
      );
    } catch (error) {
      const initAllEndTime = Date.now();
      this.logger.error(
        `Error initializing all providers after ${initAllEndTime - initAllStartTime}ms`,
        error,
      );
    }
  }

  async disposeAllProviders(): Promise<void> {
    const disposeAllStartTime = Date.now();
    this.logger.debug("Starting disposal of all providers");

    try {
      const activeProviderIds = Array.from(this.activeProviders.keys());
      this.logger.debug(`Disposing ${activeProviderIds.length} active providers`);

      const disposePromises = activeProviderIds.map((providerId) =>
        this.disposeProvider(providerId).catch((error) => {
          this.logger.error(`Failed to dispose provider ${providerId}`, error);
        }),
      );

      await Promise.allSettled(disposePromises);

      const disposeAllEndTime = Date.now();
      this.logger.info(`All providers disposed in ${disposeAllEndTime - disposeAllStartTime}ms`);
    } catch (error) {
      const disposeAllEndTime = Date.now();
      this.logger.error(
        `Error disposing all providers after ${disposeAllEndTime - disposeAllStartTime}ms`,
        error,
      );
    }
  }
}
