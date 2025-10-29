import { LLMRegistry } from "../../llm";
import { HealthCheckResult } from "../../llm/types/ProviderCapabilities";
import { EventBus } from "../../events";

export interface HealthStatus {
  providerId: string;
  isHealthy: boolean;
  lastChecked: Date;
  responseTime?: number;
  error?: string;
  consecutiveFailures: number;
}

export class ProviderHealthService {
  private healthStatus = new Map<string, HealthStatus>();
  private monitoringInterval?: NodeJS.Timeout;
  private readonly DEFAULT_CHECK_INTERVAL = 300000; // 5 minutes in milliseconds

  constructor(
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
  ) {}

  async checkProviderHealth(providerId: string): Promise<HealthStatus> {
    const provider = this.llmRegistry.getProvider(providerId);
    if (!provider) {
      const status: HealthStatus = {
        providerId,
        isHealthy: false,
        lastChecked: new Date(),
        error: "Provider not found",
        consecutiveFailures: 1,
      };
      this.healthStatus.set(providerId, status);
      return status;
    }

    const startTime = Date.now();
    let healthResult: HealthCheckResult;

    try {
      healthResult = await provider.healthCheck();
    } catch (error) {
      const responseTime = Date.now() - startTime;
      healthResult = {
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : "Unknown error",
        lastChecked: new Date(),
      };
    }

    const currentStatus = this.healthStatus.get(providerId);
    const consecutiveFailures = healthResult.isHealthy
      ? 0
      : (currentStatus?.consecutiveFailures || 0) + 1;

    const status: HealthStatus = {
      providerId,
      isHealthy: healthResult.isHealthy,
      lastChecked: healthResult.lastChecked,
      responseTime: healthResult.responseTime,
      error: healthResult.error,
      consecutiveFailures,
    };

    this.healthStatus.set(providerId, status);

    if (currentStatus?.isHealthy !== status.isHealthy) {
      this.eventBus.publish("providerHealthChanged", {
        providerId,
        isHealthy: status.isHealthy,
        previousHealth: currentStatus?.isHealthy ?? false,
      });
    }

    return status;
  }

  startHealthMonitoring(interval: number = this.DEFAULT_CHECK_INTERVAL): void {
    this.stopHealthMonitoring();

    this.monitoringInterval = setInterval(async () => {
      const providers = this.llmRegistry.list();
      const providerIds = providers.map((p) => p.id);

      for (const providerId of providerIds) {
        try {
          await this.checkProviderHealth(providerId);
        } catch (error) {
          console.error(`Health check failed for provider ${providerId}:`, error);
        }
      }
    }, interval);
  }

  stopHealthMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  getHealthyProviders(): string[] {
    const healthyProviders: string[] = [];

    for (const [providerId, status] of this.healthStatus.entries()) {
      if (status.isHealthy) {
        healthyProviders.push(providerId);
      }
    }

    return healthyProviders;
  }

  isProviderHealthy(providerId: string): boolean {
    const status = this.healthStatus.get(providerId);
    return status ? status.isHealthy : false;
  }

  getProviderHealthStatus(providerId: string): HealthStatus | undefined {
    return this.healthStatus.get(providerId);
  }

  getAllHealthStatus(): Record<string, HealthStatus> {
    const result: Record<string, HealthStatus> = {};

    for (const [providerId, status] of this.healthStatus.entries()) {
      result[providerId] = status;
    }

    return result;
  }

  getProvidersByHealth(): { healthy: string[]; unhealthy: string[]; unknown: string[] } {
    const providers = this.llmRegistry.list();
    const providerIds = providers.map((p) => p.id);

    const result = {
      healthy: [] as string[],
      unhealthy: [] as string[],
      unknown: [] as string[],
    };

    for (const providerId of providerIds) {
      const status = this.healthStatus.get(providerId);

      if (!status) {
        result.unknown.push(providerId);
      } else if (status.isHealthy) {
        result.healthy.push(providerId);
      } else {
        result.unhealthy.push(providerId);
      }
    }

    return result;
  }

  async forceHealthCheck(providerId: string): Promise<HealthStatus> {
    return this.checkProviderHealth(providerId);
  }

  async forceAllHealthChecks(): Promise<Record<string, HealthStatus>> {
    const providers = this.llmRegistry.list();
    const providerIds = providers.map((p) => p.id);
    const results: Record<string, HealthStatus> = {};

    for (const providerId of providerIds) {
      try {
        results[providerId] = await this.checkProviderHealth(providerId);
      } catch (error) {
        results[providerId] = {
          providerId,
          isHealthy: false,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : "Unknown error",
          consecutiveFailures: 1,
        };
      }
    }

    return results;
  }

  dispose(): void {
    this.stopHealthMonitoring();
    this.healthStatus.clear();
  }
}
