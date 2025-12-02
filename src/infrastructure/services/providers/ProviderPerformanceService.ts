import { LLMRegistry } from "@/llm";
import { EventBus } from "@/events";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { MetricsCollectionService } from "@/infrastructure/services/performance/MetricsCollectionService";
import { StatisticsCalculationService } from "@/infrastructure/services/performance/StatisticsCalculationService";
import { PerformanceMonitoringService } from "@/infrastructure/services/performance/PerformanceMonitoringService";

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
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
    private metricsCollectionService: MetricsCollectionService,
    private statisticsCalculationService: StatisticsCalculationService,
    private performanceMonitoringService: PerformanceMonitoringService,
    private loggingService: LoggingService = new LoggingService(),
  ) {
    this.logger = createLogger("ProviderPerformanceService");
  }

  recordGenerationStart(providerId: string): string {
    return this.metricsCollectionService.recordGenerationStart(providerId);
  }

  recordGenerationEnd(
    requestId: string,
    success: boolean,
    tokensUsed?: number,
    error?: string,
  ): void {
    const endMetric = this.metricsCollectionService.recordGenerationEnd(
      requestId,
      success,
      tokensUsed,
      error,
    );

    if (endMetric) {
      const metrics = this.metricsCollectionService.getMetricsForProvider(endMetric.providerId);
      const stats = this.statisticsCalculationService.calculateProviderStats(
        endMetric.providerId,
        metrics,
      );
      const score = this.statisticsCalculationService.calculatePerformanceScore(stats);
      this.performanceMonitoringService.updateProviderRanking(endMetric.providerId, stats, score);
    }
  }

  getProviderStats(providerId: string): PerformanceStats {
    const metrics = this.metricsCollectionService.getMetricsForProvider(providerId);
    return this.statisticsCalculationService.calculateProviderStats(providerId, metrics);
  }

  getAllProviderStats(): Record<string, PerformanceStats> {
    const metricsMap = this.metricsCollectionService.getAllMetrics();
    return this.statisticsCalculationService.getAllProviderStats(metricsMap);
  }

  getProviderRankings(): ProviderRanking[] {
    const metricsMap = this.metricsCollectionService.getAllMetrics();
    return this.statisticsCalculationService.getProviderRankings(metricsMap);
  }

  getBestPerformingProvider(): string | undefined {
    const metricsMap = this.metricsCollectionService.getAllMetrics();
    return this.statisticsCalculationService.getBestPerformingProvider(metricsMap);
  }

  getProvidersByPerformance(threshold: number = 80): {
    excellent: string[];
    good: string[];
    average: string[];
    poor: string[];
  } {
    const metricsMap = this.metricsCollectionService.getAllMetrics();
    return this.statisticsCalculationService.getProvidersByPerformance(metricsMap, threshold);
  }

  updateProviderRankings(): void {
    const rankings = this.getProviderRankings();
    this.performanceMonitoringService.updateProviderRankings(rankings);
  }

  getWeightedScore(providerId: string): number {
    const metrics = this.metricsCollectionService.getMetricsForProvider(providerId);
    return this.statisticsCalculationService.getWeightedScore(providerId, metrics);
  }

  recordSelection(providerId: string, context: Record<string, unknown>): void {
    this.metricsCollectionService.recordSelection(providerId, context);
  }

  recordFallback(fromProvider: string, toProvider: string, success: boolean): void {
    this.metricsCollectionService.recordFallback(fromProvider, toProvider, success);
  }

  clearProviderMetrics(providerId: string): void {
    this.metricsCollectionService.clearProviderMetrics(providerId);
    this.statisticsCalculationService.invalidateCache();
  }

  clearAllMetrics(): void {
    this.metricsCollectionService.clearAllMetrics();
    this.statisticsCalculationService.invalidateCache();
  }

  getMetricsForProvider(providerId: string, limit: number = 50): PerformanceMetric[] {
    return this.metricsCollectionService.getMetricsForProvider(providerId, limit);
  }

  getRecentMetrics(providerId: string, timeWindowMs: number = 3600000): PerformanceMetric[] {
    return this.metricsCollectionService.getRecentMetrics(providerId, timeWindowMs);
  }

  exportMetrics(): Record<string, PerformanceMetric[]> {
    return this.metricsCollectionService.exportMetrics();
  }

  dispose(): void {
    this.metricsCollectionService.dispose();
  }

  recordCacheHit(providerId: string, cacheKey: string): void {
    this.metricsCollectionService.recordCacheHit(providerId, cacheKey);
  }

  recordCacheMiss(providerId: string, cacheKey: string): void {
    this.metricsCollectionService.recordCacheMiss(providerId, cacheKey);
  }

  recordBatchOperation(providerId: string, batchSize: number, duration: number): void {
    this.metricsCollectionService.recordBatchOperation(providerId, batchSize, duration);
  }

  recordDebounceOperation(providerId: string, debounceTime: number): void {
    this.metricsCollectionService.recordDebounceOperation(providerId, debounceTime);
  }

  recordBackgroundTask(taskId: string, duration: number, success: boolean): void {
    this.metricsCollectionService.recordBackgroundTask(taskId, duration, success);
  }

  recordMemoryOptimization(freedBytes: number, duration: number): void {
    this.metricsCollectionService.recordMemoryOptimization(freedBytes, duration);
  }

  getCacheStatistics(): { hits: number; misses: number; hitRate: number } {
    const metricsMap = this.metricsCollectionService.getAllMetrics();
    return this.performanceMonitoringService.getCacheStatistics(metricsMap);
  }

  getBatchStatistics(): {
    totalBatches: number;
    averageBatchSize: number;
    averageDuration: number;
  } {
    const metricsMap = this.metricsCollectionService.getAllMetrics();
    return this.performanceMonitoringService.getBatchStatistics(metricsMap);
  }

  getBackgroundTaskStatistics(): {
    totalTasks: number;
    successRate: number;
    averageDuration: number;
  } {
    const metricsMap = this.metricsCollectionService.getAllMetrics();
    return this.performanceMonitoringService.getBackgroundTaskStatistics(metricsMap);
  }

  getMemoryOptimizationStatistics(): {
    totalOptimizations: number;
    averageFreedBytes: number;
    averageDuration: number;
  } {
    const metricsMap = this.metricsCollectionService.getAllMetrics();
    return this.performanceMonitoringService.getMemoryOptimizationStatistics(metricsMap);
  }
}
