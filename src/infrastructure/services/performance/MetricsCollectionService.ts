import { EventBus } from "../../../events";
import { LoggingService, createLogger, type Logger } from "../LoggingService";
import type { PerformanceMetric } from "../ProviderPerformanceService";
import { ServiceLimits } from "../../../constants";

export class MetricsCollectionService {
  private performanceMetrics = new Map<string, PerformanceMetric[]>();
  private readonly MAX_METRICS_PER_PROVIDER = ServiceLimits.maxMetricsPerProvider;
  private readonly PERFORMANCE_WINDOW_MS = ServiceLimits.performanceWindowMs;
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("MetricsCollectionService");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logWarn(message: string, data?: unknown): void {
    this.logger.warn(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  recordGenerationStart(providerId: string): string {
    const requestId = `${providerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.logDebug(
      `Recording generation start for provider ${providerId} with request ID ${requestId}`,
    );

    const metric: PerformanceMetric = {
      providerId,
      timestamp: new Date(),
      duration: 0,
      success: false,
      error: undefined,
    };

    try {
      this.addMetric(providerId, metric);
      return requestId;
    } catch (error) {
      this.logError(`Error recording generation start for provider ${providerId}:`, error);
      throw error;
    }
  }

  recordGenerationEnd(
    requestId: string,
    success: boolean,
    tokensUsed?: number,
    error?: string,
  ): PerformanceMetric | null {
    const [providerId, timestamp] = requestId.split("-");
    const requestTime = parseInt(timestamp);
    const requestDate = new Date(requestTime);
    const duration = Date.now() - requestTime;

    this.logDebug(
      `Recording generation end for provider ${providerId}, success: ${success}, duration: ${duration}ms, tokens: ${tokensUsed || "N/A"}`,
    );

    try {
      const existingMetrics = this.performanceMetrics.get(providerId);
      const startMetric = existingMetrics?.find(
        (m) => m.timestamp.getTime() === requestDate.getTime() && !m.success,
      );

      if (!startMetric) {
        this.logWarn(`No start metric found for request: ${requestId}`);
        return null;
      }

      const endMetric: PerformanceMetric = {
        providerId,
        timestamp: requestDate,
        duration,
        success,
        tokensUsed,
        error,
      };

      this.addMetric(providerId, endMetric);

      if (success) {
        if (duration > ServiceLimits.slowOperationThreshold) {
          this.logWarn(
            `SLOW OPERATION - Provider ${providerId} generation took ${duration}ms (threshold: ${ServiceLimits.slowOperationThreshold}ms)`,
          );
        } else {
          this.logDebug(
            `Provider ${providerId} generation completed successfully in ${duration}ms`,
          );
        }
      } else {
        this.logError(
          `Provider ${providerId} generation failed after ${duration}ms: ${error || "Unknown error"}`,
        );
      }

      return endMetric;
    } catch (recordError) {
      this.logError(`Error recording generation end for provider ${providerId}:`, recordError);
      return null;
    }
  }

  addMetric(providerId: string, metric: PerformanceMetric): void {
    try {
      if (!this.performanceMetrics.has(providerId)) {
        this.performanceMetrics.set(providerId, []);
        this.logDebug(`Created metrics collection for provider ${providerId}`);
      }

      const metrics = this.performanceMetrics.get(providerId)!;
      metrics.push(metric);

      if (metrics.length > this.MAX_METRICS_PER_PROVIDER) {
        const removedCount = metrics.length - this.MAX_METRICS_PER_PROVIDER;
        metrics.splice(0, removedCount);
        this.logDebug(
          `Removed ${removedCount} old metrics for provider ${providerId} (max: ${this.MAX_METRICS_PER_PROVIDER})`,
        );
      }

      this.cleanupOldMetrics(providerId);
    } catch (error) {
      this.logError(`Error adding metric for provider ${providerId}:`, error);
    }
  }

  private cleanupOldMetrics(providerId: string): void {
    try {
      const metrics = this.performanceMetrics.get(providerId);
      if (!metrics) return;

      const cutoffTime = Date.now() - this.PERFORMANCE_WINDOW_MS;
      const filteredMetrics = metrics.filter((m) => m.timestamp.getTime() > cutoffTime);

      if (filteredMetrics.length < metrics.length) {
        const removedCount = metrics.length - filteredMetrics.length;
        this.performanceMetrics.set(providerId, filteredMetrics);
        this.logDebug(
          `Cleaned up ${removedCount} old metrics for provider ${providerId} (older than ${this.PERFORMANCE_WINDOW_MS}ms)`,
        );
      }
    } catch (error) {
      this.logError(`Error cleaning up old metrics for provider ${providerId}:`, error);
    }
  }

  recordSelection(providerId: string, context: any): void {
    this.logDebug(`Recording provider selection for ${providerId}`);

    try {
      const metric: PerformanceMetric = {
        providerId,
        timestamp: new Date(),
        duration: 0,
        success: true,
        tokensUsed: 0,
      };

      this.addMetric(providerId, metric);
      this.eventBus.publish("provider-selected", {
        providerId,
        context,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logError(`Error recording selection for provider ${providerId}:`, error);
    }
  }

  recordFallback(fromProvider: string, toProvider: string, success: boolean): void {
    this.logDebug(`Recording fallback from ${fromProvider} to ${toProvider}, success: ${success}`);

    try {
      const metric: PerformanceMetric = {
        providerId: fromProvider,
        timestamp: new Date(),
        duration: 0,
        success,
        error: success ? undefined : `Fallback to ${toProvider}`,
      };

      this.addMetric(fromProvider, metric);
      this.addMetric(toProvider, {
        ...metric,
        providerId: toProvider,
        success: true,
      });

      this.eventBus.publish("provider-fallback", {
        fromProvider,
        toProvider,
        success,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logError(`Error recording fallback from ${fromProvider} to ${toProvider}:`, error);
    }
  }

  recordCacheHit(providerId: string, cacheKey: string): void {
    const metric: PerformanceMetric = {
      providerId,
      timestamp: new Date(),
      duration: 0,
      success: true,
      tokensUsed: 0,
    };

    this.addMetric(providerId, metric);
    this.eventBus.publish("cacheHit", { providerId, cacheKey });
  }

  recordCacheMiss(providerId: string, cacheKey: string): void {
    const metric: PerformanceMetric = {
      providerId,
      timestamp: new Date(),
      duration: 0,
      success: false,
      error: "Cache miss",
    };

    this.addMetric(providerId, metric);
    this.eventBus.publish("cacheMiss", { providerId, cacheKey });
  }

  recordBatchOperation(providerId: string, batchSize: number, duration: number): void {
    const metric: PerformanceMetric = {
      providerId,
      timestamp: new Date(),
      duration,
      success: true,
      tokensUsed: 0,
    };

    this.addMetric(providerId, metric);
    this.eventBus.publish("batchOperation", { providerId, batchSize, duration });
  }

  recordDebounceOperation(providerId: string, debounceTime: number): void {
    const metric: PerformanceMetric = {
      providerId,
      timestamp: new Date(),
      duration: debounceTime,
      success: true,
      tokensUsed: 0,
    };

    this.addMetric(providerId, metric);
    this.eventBus.publish("debounceOperation", { providerId, debounceTime });
  }

  recordBackgroundTask(taskId: string, duration: number, success: boolean): void {
    const metric: PerformanceMetric = {
      providerId: "background",
      timestamp: new Date(),
      duration,
      success,
      tokensUsed: 0,
    };

    this.addMetric("background", metric);
    this.eventBus.publish("backgroundTask", { taskId, duration, success });
  }

  recordMemoryOptimization(freedBytes: number, duration: number): void {
    const metric: PerformanceMetric = {
      providerId: "system",
      timestamp: new Date(),
      duration,
      success: true,
      tokensUsed: 0,
    };

    this.addMetric("system", metric);
    this.eventBus.publish("memoryOptimization", { freedBytes, duration });
  }

  getMetricsForProvider(providerId: string, limit: number = 50): PerformanceMetric[] {
    const metrics = this.performanceMetrics.get(providerId) || [];
    return metrics.slice(-limit);
  }

  getRecentMetrics(providerId: string, timeWindowMs: number = 3600000): PerformanceMetric[] {
    const metrics = this.performanceMetrics.get(providerId) || [];
    const cutoffTime = Date.now() - timeWindowMs;

    return metrics.filter((m) => m.timestamp.getTime() > cutoffTime);
  }

  getAllMetrics(): Map<string, PerformanceMetric[]> {
    return this.performanceMetrics;
  }

  clearProviderMetrics(providerId: string): void {
    this.performanceMetrics.delete(providerId);
    this.eventBus.publish("providerMetricsCleared", { providerId });
  }

  clearAllMetrics(): void {
    this.performanceMetrics.clear();
    this.eventBus.publish("allProviderMetricsCleared", {});
  }

  exportMetrics(): Record<string, PerformanceMetric[]> {
    const result: Record<string, PerformanceMetric[]> = {};

    for (const [providerId, metrics] of this.performanceMetrics.entries()) {
      result[providerId] = [...metrics];
    }

    return result;
  }

  dispose(): void {
    this.performanceMetrics.clear();
  }
}
