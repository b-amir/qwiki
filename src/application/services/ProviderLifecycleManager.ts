import { EventBus } from "../../events/EventBus";
import { ProviderDiscoveryService } from "./ProviderDiscoveryService";
import { LLMProvider } from "../../llm/types";
import { HealthCheckResult } from "../../llm/types/ProviderCapabilities";

export enum ProviderState {
  UNLOADED = "unloaded",
  LOADING = "loading",
  LOADED = "loaded",
  INITIALIZING = "initializing",
  READY = "ready",
  ERROR = "error",
  DISPOSING = "disposing",
}

export class ProviderLifecycleManager {
  private activeProviders = new Map<string, LLMProvider>();
  private providerStates = new Map<string, ProviderState>();
  private initializationPromises = new Map<string, Promise<void>>();

  constructor(
    private providerDiscoveryService: ProviderDiscoveryService,
    private eventBus: EventBus,
  ) {}

  async initializeProvider(providerId: string): Promise<void> {
    if (this.initializationPromises.has(providerId)) {
      return this.initializationPromises.get(providerId)!;
    }

    const initializationPromise = this._initializeProviderInternal(providerId);
    this.initializationPromises.set(providerId, initializationPromise);

    try {
      await initializationPromise;
    } finally {
      this.initializationPromises.delete(providerId);
    }
  }

  private async _initializeProviderInternal(providerId: string): Promise<void> {
    this.setProviderState(providerId, ProviderState.INITIALIZING);

    try {
      const discoveredProviders = this.providerDiscoveryService.getDiscoveredProviders();
      const metadata = discoveredProviders.find((p) => p.id === providerId);

      if (!metadata) {
        throw new Error(`Provider ${providerId} not found in discovered providers`);
      }

      const provider = await this.providerDiscoveryService.loadProviderFromMetadata(metadata);
      if (!provider) {
        throw new Error(`Failed to load provider ${providerId}`);
      }

      this.activeProviders.set(providerId, provider);
      this.setProviderState(providerId, ProviderState.LOADED);

      await provider.initialize();
      this.setProviderState(providerId, ProviderState.READY);

      this.eventBus.publish("provider-initialized", { providerId, provider });
    } catch (error) {
      this.setProviderState(providerId, ProviderState.ERROR);
      this.eventBus.publish("provider-error", { providerId, error });
      throw error;
    }
  }

  async disposeProvider(providerId: string): Promise<void> {
    this.setProviderState(providerId, ProviderState.DISPOSING);

    try {
      const provider = this.activeProviders.get(providerId);
      if (provider) {
        await provider.dispose();
        this.activeProviders.delete(providerId);
      }

      this.setProviderState(providerId, ProviderState.UNLOADED);
      this.eventBus.publish("provider-disposed", { providerId });
    } catch (error) {
      this.setProviderState(providerId, ProviderState.ERROR);
      this.eventBus.publish("provider-error", { providerId, error });
      throw error;
    }
  }

  async restartProvider(providerId: string): Promise<void> {
    try {
      await this.disposeProvider(providerId);
      await this.initializeProvider(providerId);
      this.eventBus.publish("provider-restarted", { providerId });
    } catch (error) {
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
    const provider = this.activeProviders.get(providerId);
    if (!provider) {
      return {
        isHealthy: false,
        responseTime: 0,
        error: `Provider ${providerId} is not active`,
        lastChecked: new Date(),
      };
    }

    try {
      const result = await provider.healthCheck();
      this.eventBus.publish("provider-health-checked", { providerId, result });
      return result;
    } catch (error) {
      const errorResult: HealthCheckResult = {
        isHealthy: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error),
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
    const discoveredProviders = this.providerDiscoveryService.getDiscoveredProviders();
    const initializationPromises = discoveredProviders.map((provider) =>
      this.initializeProvider(provider.id).catch((error) => {
        console.error(`Failed to initialize provider ${provider.id}:`, error);
      }),
    );

    await Promise.allSettled(initializationPromises);
  }

  async disposeAllProviders(): Promise<void> {
    const disposePromises = Array.from(this.activeProviders.keys()).map((providerId) =>
      this.disposeProvider(providerId).catch((error) => {
        console.error(`Failed to dispose provider ${providerId}:`, error);
      }),
    );

    await Promise.allSettled(disposePromises);
  }
}
