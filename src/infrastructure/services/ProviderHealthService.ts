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
    const healthCheckStartTime = Date.now();
    console.log(`[QWIKI] ProviderHealthService: Starting health check for provider ${providerId}`);

    const provider = this.llmRegistry.getProvider(providerId);
    if (!provider) {
      const error = "Provider not found";
      console.error(
        `[QWIKI] ProviderHealthService: Health check failed for ${providerId} - ${error}`,
      );

      const status: HealthStatus = {
        providerId,
        isHealthy: false,
        lastChecked: new Date(),
        error,
        consecutiveFailures: 1,
      };
      this.healthStatus.set(providerId, status);
      return status;
    }

    const startTime = Date.now();
    let healthResult: HealthCheckResult;

    try {
      console.log(
        `[QWIKI] ProviderHealthService: Executing health check for provider ${providerId}`,
      );
      healthResult = await provider.healthCheck();

      const healthCheckEndTime = Date.now();
      const responseTime = healthCheckEndTime - startTime;

      if (healthResult.isHealthy) {
        console.log(
          `[QWIKI] ProviderHealthService: Health check passed for provider ${providerId} in ${responseTime}ms`,
        );
      } else {
        console.warn(
          `[QWIKI] ProviderHealthService: Health check failed for provider ${providerId} in ${responseTime}ms: ${healthResult.error}`,
        );
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      console.error(
        `[QWIKI] ProviderHealthService: Health check error for provider ${providerId} after ${responseTime}ms:`,
        error,
      );

      healthResult = {
        isHealthy: false,
        responseTime,
        error: errorMessage,
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
      const healthChange = status.isHealthy ? "healthy" : "unhealthy";
      console.log(
        `[QWIKI] ProviderHealthService: Provider ${providerId} health changed to ${healthChange}`,
      );

      this.eventBus.publish("providerHealthChanged", {
        providerId,
        isHealthy: status.isHealthy,
        previousHealth: currentStatus?.isHealthy ?? false,
      });
    }

    const totalHealthCheckTime = Date.now() - healthCheckStartTime;
    console.log(
      `[QWIKI] ProviderHealthService: Total health check completed for provider ${providerId} in ${totalHealthCheckTime}ms`,
    );

    return status;
  }

  startHealthMonitoring(interval: number = this.DEFAULT_CHECK_INTERVAL): void {
    console.log(
      `[QWIKI] ProviderHealthService: Starting health monitoring with ${interval}ms interval`,
    );
    this.stopHealthMonitoring();

    this.monitoringInterval = setInterval(async () => {
      const monitoringStartTime = Date.now();
      console.log(`[QWIKI] ProviderHealthService: Running periodic health check for all providers`);

      try {
        const providers = this.llmRegistry.list();
        const providerIds = providers.map((p) => p.id);
        console.log(
          `[QWIKI] ProviderHealthService: Checking health for ${providerIds.length} providers`,
        );

        for (const providerId of providerIds) {
          try {
            await this.checkProviderHealth(providerId);
          } catch (error) {
            console.error(
              `[QWIKI] ProviderHealthService: Health check failed for provider ${providerId}:`,
              error,
            );
          }
        }

        const monitoringEndTime = Date.now();
        console.log(
          `[QWIKI] ProviderHealthService: Periodic health check completed in ${monitoringEndTime - monitoringStartTime}ms`,
        );
      } catch (error) {
        console.error(
          `[QWIKI] ProviderHealthService: Error during periodic health monitoring:`,
          error,
        );
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
    console.log(`[QWIKI] ProviderHealthService: Forcing health check for provider ${providerId}`);
    return this.checkProviderHealth(providerId);
  }

  async forceAllHealthChecks(): Promise<Record<string, HealthStatus>> {
    const forceAllStartTime = Date.now();
    console.log("[QWIKI] ProviderHealthService: Forcing health checks for all providers");

    try {
      const providers = this.llmRegistry.list();
      const providerIds = providers.map((p) => p.id);
      const results: Record<string, HealthStatus> = {};

      console.log(
        `[QWIKI] ProviderHealthService: Forcing health checks for ${providerIds.length} providers`,
      );

      for (const providerId of providerIds) {
        try {
          results[providerId] = await this.checkProviderHealth(providerId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(
            `[QWIKI] ProviderHealthService: Force health check failed for provider ${providerId}:`,
            error,
          );

          results[providerId] = {
            providerId,
            isHealthy: false,
            lastChecked: new Date(),
            error: errorMessage,
            consecutiveFailures: 1,
          };
        }
      }

      const forceAllEndTime = Date.now();
      console.log(
        `[QWIKI] ProviderHealthService: All forced health checks completed in ${forceAllEndTime - forceAllStartTime}ms`,
      );

      return results;
    } catch (error) {
      const forceAllEndTime = Date.now();
      console.error(
        `[QWIKI] ProviderHealthService: Error during forced health checks after ${forceAllEndTime - forceAllStartTime}ms:`,
        error,
      );
      throw error;
    }
  }

  dispose(): void {
    this.stopHealthMonitoring();
    this.healthStatus.clear();
  }
}
