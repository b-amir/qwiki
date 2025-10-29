import { LLMRegistry } from "../../llm";
import { EventBus } from "../../events";
import { GenerationCacheService } from "./GenerationCacheService";
import { RequestBatchingService } from "./RequestBatchingService";
import { DebouncingService } from "./DebouncingService";
import { BackgroundProcessingService } from "./BackgroundProcessingService";
import { MemoryOptimizationService } from "./MemoryOptimizationService";

export interface PerformanceMetric {
  providerId: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  tokensUsed?: number;
  error?: string;
}

export interface PerformanceStats {
  providerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  successRate: number;
  lastRequestTime: Date;
  averageTokensPerRequest?: number;
}

export interface ProviderRanking {
  providerId: string;
  score: number;
  stats: PerformanceStats;
}

export class ProviderPerformanceService {
  private performanceMetrics = new Map<string, PerformanceMetric[]>();
  private readonly MAX_METRICS_PER_PROVIDER = 100;
  private readonly PERFORMANCE_WINDOW_MS = 3600000; // 1 hour in milliseconds

  constructor(
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
    private generationCacheService?: GenerationCacheService,
    private requestBatchingService?: RequestBatchingService,
    private debouncingService?: DebouncingService,
    private backgroundProcessingService?: BackgroundProcessingService,
    private memoryOptimizationService?: MemoryOptimizationService,
  ) {}

  recordGenerationStart(providerId: string): string {
    const requestId = `${providerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(
      `[QWIKI] ProviderPerformanceService: Recording generation start for provider ${providerId} with request ID ${requestId}`,
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
      console.error(
        `[QWIKI] ProviderPerformanceService: Error recording generation start for provider ${providerId}:`,
        error,
      );
      throw error;
    }
  }

  recordGenerationEnd(
    requestId: string,
    success: boolean,
    tokensUsed?: number,
    error?: string,
  ): void {
    const [providerId, timestamp] = requestId.split("-");
    const requestTime = parseInt(timestamp);
    const requestDate = new Date(requestTime);
    const duration = Date.now() - requestTime;

    console.log(
      `[QWIKI] ProviderPerformanceService: Recording generation end for provider ${providerId}, success: ${success}, duration: ${duration}ms, tokens: ${tokensUsed || "N/A"}`,
    );

    try {
      const existingMetrics = this.performanceMetrics.get(providerId);
      const startMetric = existingMetrics?.find(
        (m) => m.timestamp.getTime() === requestDate.getTime() && !m.success,
      );

      if (!startMetric) {
        console.warn(
          `[QWIKI] ProviderPerformanceService: No start metric found for request: ${requestId}`,
        );
        return;
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
      this.updateProviderRanking(providerId);

      if (success) {
        if (duration > 5000) {
          console.warn(
            `[QWIKI] ProviderPerformanceService: SLOW OPERATION - Provider ${providerId} generation took ${duration}ms (threshold: 5000ms)`,
          );
        } else {
          console.log(
            `[QWIKI] ProviderPerformanceService: Provider ${providerId} generation completed successfully in ${duration}ms`,
          );
        }
      } else {
        console.error(
          `[QWIKI] ProviderPerformanceService: Provider ${providerId} generation failed after ${duration}ms: ${error || "Unknown error"}`,
        );
      }
    } catch (recordError) {
      console.error(
        `[QWIKI] ProviderPerformanceService: Error recording generation end for provider ${providerId}:`,
        recordError,
      );
    }
  }

  private addMetric(providerId: string, metric: PerformanceMetric): void {
    try {
      if (!this.performanceMetrics.has(providerId)) {
        this.performanceMetrics.set(providerId, []);
        console.log(
          `[QWIKI] ProviderPerformanceService: Created metrics collection for provider ${providerId}`,
        );
      }

      const metrics = this.performanceMetrics.get(providerId)!;
      metrics.push(metric);

      if (metrics.length > this.MAX_METRICS_PER_PROVIDER) {
        const removedCount = metrics.length - this.MAX_METRICS_PER_PROVIDER;
        metrics.splice(0, removedCount);
        console.log(
          `[QWIKI] ProviderPerformanceService: Removed ${removedCount} old metrics for provider ${providerId} (max: ${this.MAX_METRICS_PER_PROVIDER})`,
        );
      }

      this.cleanupOldMetrics(providerId);
    } catch (error) {
      console.error(
        `[QWIKI] ProviderPerformanceService: Error adding metric for provider ${providerId}:`,
        error,
      );
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
        console.log(
          `[QWIKI] ProviderPerformanceService: Cleaned up ${removedCount} old metrics for provider ${providerId} (older than ${this.PERFORMANCE_WINDOW_MS}ms)`,
        );
      }
    } catch (error) {
      console.error(
        `[QWIKI] ProviderPerformanceService: Error cleaning up old metrics for provider ${providerId}:`,
        error,
      );
    }
  }

  private updateProviderRanking(providerId: string): void {
    const stats = this.calculateProviderStats(providerId);
    const ranking: ProviderRanking = {
      providerId,
      score: this.calculatePerformanceScore(stats),
      stats,
    };

    this.eventBus.publish("providerPerformanceUpdated", { providerId, ranking });
  }

  private calculatePerformanceScore(stats: PerformanceStats): number {
    let score = 0;

    score += Math.min(50, stats.successRate * 100);
    score += Math.min(30, 1000 / Math.max(1, stats.averageResponseTime));
    score += Math.min(20, stats.totalRequests / 10);

    if (stats.averageTokensPerRequest) {
      score += Math.min(10, stats.averageTokensPerRequest / 100);
    }

    return Math.round(score);
  }

  private calculateProviderStats(providerId: string): PerformanceStats {
    const metrics = this.performanceMetrics.get(providerId) || [];

    if (metrics.length === 0) {
      return {
        providerId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        successRate: 0,
        lastRequestTime: new Date(),
        averageTokensPerRequest: 0,
      };
    }

    const totalRequests = metrics.length / 2;
    const successfulRequests = metrics.filter((m) => m.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalRequests > 0 ? totalDuration / totalRequests : 0;

    const lastRequest = metrics[metrics.length - 1];
    const lastRequestTime = lastRequest ? lastRequest.timestamp : new Date();

    const tokenMetrics = metrics.filter((m) => m.tokensUsed && m.tokensUsed > 0);
    const averageTokensPerRequest =
      tokenMetrics.length > 0
        ? tokenMetrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0) / tokenMetrics.length
        : undefined;

    return {
      providerId,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      successRate,
      lastRequestTime,
      averageTokensPerRequest,
    };
  }

  getProviderStats(providerId: string): PerformanceStats {
    try {
      const stats = this.calculateProviderStats(providerId);
      console.log(
        `[QWIKI] ProviderPerformanceService: Retrieved stats for provider ${providerId} - Total: ${stats.totalRequests}, Success Rate: ${stats.successRate.toFixed(2)}%, Avg Response: ${stats.averageResponseTime.toFixed(2)}ms`,
      );
      return stats;
    } catch (error) {
      console.error(
        `[QWIKI] ProviderPerformanceService: Error getting stats for provider ${providerId}:`,
        error,
      );
      return this.calculateProviderStats(providerId);
    }
  }

  getAllProviderStats(): Record<string, PerformanceStats> {
    const getAllStatsStartTime = Date.now();
    console.log("[QWIKI] ProviderPerformanceService: Retrieving stats for all providers");

    try {
      const result: Record<string, PerformanceStats> = {};
      const providers = this.llmRegistry.list();
      const providerIds = providers.map((p: any) => p.id);

      console.log(
        `[QWIKI] ProviderPerformanceService: Processing stats for ${providerIds.length} providers`,
      );

      for (const providerId of providerIds) {
        result[providerId] = this.getProviderStats(providerId);
      }

      const getAllStatsEndTime = Date.now();
      console.log(
        `[QWIKI] ProviderPerformanceService: Retrieved all provider stats in ${getAllStatsEndTime - getAllStatsStartTime}ms`,
      );

      return result;
    } catch (error) {
      const getAllStatsEndTime = Date.now();
      console.error(
        `[QWIKI] ProviderPerformanceService: Error getting all provider stats after ${getAllStatsEndTime - getAllStatsStartTime}ms:`,
        error,
      );
      throw error;
    }
  }

  getProviderRankings(): ProviderRanking[] {
    const rankings: ProviderRanking[] = [];
    const providers = this.llmRegistry.list();
    const providerIds = providers.map((p: any) => p.id);

    for (const providerId of providerIds) {
      const stats = this.getProviderStats(providerId);
      rankings.push({
        providerId,
        score: this.calculatePerformanceScore(stats),
        stats,
      });
    }

    return rankings.sort((a, b) => b.score - a.score);
  }

  getBestPerformingProvider(): string | undefined {
    const rankings = this.getProviderRankings();
    return rankings.length > 0 ? rankings[0].providerId : undefined;
  }

  getProvidersByPerformance(threshold: number = 80): {
    excellent: string[];
    good: string[];
    average: string[];
    poor: string[];
  } {
    const rankings = this.getProviderRankings();

    const result = {
      excellent: [] as string[],
      good: [] as string[],
      average: [] as string[],
      poor: [] as string[],
    };

    for (const ranking of rankings) {
      if (ranking.score >= threshold + 20) {
        result.excellent.push(ranking.providerId);
      } else if (ranking.score >= threshold) {
        result.good.push(ranking.providerId);
      } else if (ranking.score >= threshold - 20) {
        result.average.push(ranking.providerId);
      } else {
        result.poor.push(ranking.providerId);
      }
    }

    return result;
  }

  updateProviderRankings(): void {
    const rankings = this.getProviderRankings();
    for (const ranking of rankings) {
      this.eventBus.publish("provider-ranking-updated", {
        providerId: ranking.providerId,
        score: ranking.score,
        stats: ranking.stats,
      });
    }
  }

  getWeightedScore(providerId: string): number {
    const stats = this.getProviderStats(providerId);
    if (!stats) return 0;

    let score = 0;

    score += Math.min(50, stats.successRate);
    score += Math.min(30, 1000 / Math.max(1, stats.averageResponseTime));
    score += Math.min(20, stats.totalRequests / 10);

    if (stats.averageTokensPerRequest) {
      score += Math.min(10, stats.averageTokensPerRequest / 100);
    }

    return Math.round(score);
  }

  recordSelection(providerId: string, context: any): void {
    console.log(
      `[QWIKI] ProviderPerformanceService: Recording provider selection for ${providerId}`,
    );

    try {
      const stats = this.getProviderStats(providerId);
      if (!stats) {
        console.warn(
          `[QWIKI] ProviderPerformanceService: No stats found for provider ${providerId} during selection recording`,
        );
        return;
      }

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
      console.error(
        `[QWIKI] ProviderPerformanceService: Error recording selection for provider ${providerId}:`,
        error,
      );
    }
  }

  recordFallback(fromProvider: string, toProvider: string, success: boolean): void {
    console.log(
      `[QWIKI] ProviderPerformanceService: Recording fallback from ${fromProvider} to ${toProvider}, success: ${success}`,
    );

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
      console.error(
        `[QWIKI] ProviderPerformanceService: Error recording fallback from ${fromProvider} to ${toProvider}:`,
        error,
      );
    }
  }

  clearProviderMetrics(providerId: string): void {
    this.performanceMetrics.delete(providerId);
    this.eventBus.publish("providerMetricsCleared", { providerId });
  }

  clearAllMetrics(): void {
    this.performanceMetrics.clear();
    this.eventBus.publish("allProviderMetricsCleared", {});
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

  getCacheStatistics(): { hits: number; misses: number; hitRate: number } {
    let hits = 0;
    let misses = 0;

    for (const metrics of this.performanceMetrics.values()) {
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

  getBatchStatistics(): {
    totalBatches: number;
    averageBatchSize: number;
    averageDuration: number;
  } {
    let totalBatches = 0;
    let totalSize = 0;
    let totalDuration = 0;

    for (const metrics of this.performanceMetrics.values()) {
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

  getBackgroundTaskStatistics(): {
    totalTasks: number;
    successRate: number;
    averageDuration: number;
  } {
    let totalTasks = 0;
    let successfulTasks = 0;
    let totalDuration = 0;

    const backgroundMetrics = this.performanceMetrics.get("background") || [];
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

  getMemoryOptimizationStatistics(): {
    totalOptimizations: number;
    averageFreedBytes: number;
    averageDuration: number;
  } {
    let totalOptimizations = 0;
    let totalFreedBytes = 0;
    let totalDuration = 0;

    const systemMetrics = this.performanceMetrics.get("system") || [];
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
