import { EventBus } from "../../../events";
import { LoggingService, createLogger, type Logger } from "../LoggingService";
import type { PerformanceMetric } from "../ProviderPerformanceService";

export class PerformanceMonitoringService {
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("PerformanceMonitoringService", loggingService);
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  updateProviderRanking(
    providerId: string,
    stats: import("../ProviderPerformanceService").PerformanceStats,
    score: number,
  ): void {
    const ranking: import("../ProviderPerformanceService").ProviderRanking = {
      providerId,
      score,
      stats,
    };

    this.eventBus.publish("providerPerformanceUpdated", { providerId, ranking });
  }

  updateProviderRankings(
    rankings: import("../ProviderPerformanceService").ProviderRanking[],
  ): void {
    for (const ranking of rankings) {
      this.eventBus.publish("provider-ranking-updated", {
        providerId: ranking.providerId,
        score: ranking.score,
        stats: ranking.stats,
      });
    }
  }

  getCacheStatistics(metricsMap: Map<string, PerformanceMetric[]>): {
    hits: number;
    misses: number;
    hitRate: number;
  } {
    let hits = 0;
    let misses = 0;

    for (const metrics of metricsMap.values()) {
      for (const metric of metrics) {
        if (metric.success && metric.error === undefined) {
          if (metric.duration === 0 && metric.tokensUsed === 0) {
            hits++;
          } else {
            misses++;
          }
        }
      }
    }

    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;

    return { hits, misses, hitRate };
  }

  getBatchStatistics(metricsMap: Map<string, PerformanceMetric[]>): {
    totalBatches: number;
    averageBatchSize: number;
    averageDuration: number;
  } {
    let totalBatches = 0;
    let totalSize = 0;
    let totalDuration = 0;

    for (const metrics of metricsMap.values()) {
      for (const metric of metrics) {
        if (metric.success && metric.duration > 0) {
          totalBatches++;
          totalSize += metric.tokensUsed || 0;
          totalDuration += metric.duration;
        }
      }
    }

    const averageBatchSize = totalBatches > 0 ? totalSize / totalBatches : 0;
    const averageDuration = totalBatches > 0 ? totalDuration / totalBatches : 0;

    return { totalBatches, averageBatchSize, averageDuration };
  }

  getBackgroundTaskStatistics(metricsMap: Map<string, PerformanceMetric[]>): {
    totalTasks: number;
    successRate: number;
    averageDuration: number;
  } {
    let totalTasks = 0;
    let successfulTasks = 0;
    let totalDuration = 0;

    const backgroundMetrics = metricsMap.get("background") || [];
    for (const metric of backgroundMetrics) {
      totalTasks++;
      totalDuration += metric.duration;
      if (metric.success) {
        successfulTasks++;
      }
    }

    const successRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;
    const averageDuration = totalTasks > 0 ? totalDuration / totalTasks : 0;

    return { totalTasks, successRate, averageDuration };
  }

  getMemoryOptimizationStatistics(metricsMap: Map<string, PerformanceMetric[]>): {
    totalOptimizations: number;
    averageFreedBytes: number;
    averageDuration: number;
  } {
    let totalOptimizations = 0;
    let totalFreedBytes = 0;
    let totalDuration = 0;

    const systemMetrics = metricsMap.get("system") || [];
    for (const metric of systemMetrics) {
      if (metric.success) {
        totalOptimizations++;
        totalFreedBytes += metric.tokensUsed || 0;
        totalDuration += metric.duration;
      }
    }

    const averageFreedBytes = totalOptimizations > 0 ? totalFreedBytes / totalOptimizations : 0;
    const averageDuration = totalOptimizations > 0 ? totalDuration / totalOptimizations : 0;

    return { totalOptimizations, averageFreedBytes, averageDuration };
  }
}
