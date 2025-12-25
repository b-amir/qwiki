import { LLMRegistry } from "@/llm";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import type {
  PerformanceMetric,
  PerformanceStats,
  ProviderRanking,
} from "../providers/ProviderPerformanceService";
import { ServiceLimits } from "@/constants";

export class StatisticsCalculationService {
  private statsCache: Record<string, PerformanceStats> | null = null;
  private statsCacheTimestamp: number = 0;
  private readonly STATS_CACHE_TTL_MS = ServiceLimits.statsCacheTTL;
  private logger: Logger;

  constructor(
    private llmRegistry: LLMRegistry,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("StatisticsCalculationService");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  calculateProviderStats(providerId: string, metrics: PerformanceMetric[]): PerformanceStats {
    return this.calculateProviderStatsFromMetrics(providerId, metrics);
  }

  calculateProviderStatsFromMetrics(
    providerId: string,
    metrics: PerformanceMetric[],
  ): PerformanceStats {
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
    let successfulRequests = 0;
    let totalDuration = 0;
    let tokenCount = 0;
    let tokenSum = 0;

    for (const metric of metrics) {
      if (metric.success) {
        successfulRequests++;
      }
      totalDuration += metric.duration;
      if (metric.tokensUsed && metric.tokensUsed > 0) {
        tokenCount++;
        tokenSum += metric.tokensUsed;
      }
    }

    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    const averageResponseTime = totalRequests > 0 ? totalDuration / totalRequests : 0;

    const lastRequest = metrics[metrics.length - 1];
    const lastRequestTime = lastRequest ? lastRequest.timestamp : new Date();

    const averageTokensPerRequest = tokenCount > 0 ? tokenSum / tokenCount : undefined;

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

  calculatePerformanceScore(stats: PerformanceStats): number {
    let score = 0;

    score += Math.min(50, stats.successRate * 100);
    score += Math.min(30, 1000 / Math.max(1, stats.averageResponseTime));
    score += Math.min(20, stats.totalRequests / 10);

    if (stats.averageTokensPerRequest) {
      score += Math.min(10, stats.averageTokensPerRequest / 100);
    }

    return Math.round(score);
  }

  getAllProviderStats(
    metricsMap: Map<string, PerformanceMetric[]>,
  ): Record<string, PerformanceStats> {
    const now = Date.now();
    if (this.statsCache && now - this.statsCacheTimestamp < this.STATS_CACHE_TTL_MS) {
      return this.statsCache;
    }

    const getAllStatsStartTime = Date.now();
    this.logDebug("Retrieving stats for all providers");

    try {
      const result: Record<string, PerformanceStats> = {};
      const providers = this.llmRegistry.list();
      const providerIdSet = new Set(providers.map((p) => p.id));

      this.logDebug(`Processing stats for ${providerIdSet.size} providers`);

      for (const [providerId, metrics] of metricsMap.entries()) {
        if (providerIdSet.has(providerId)) {
          result[providerId] = this.calculateProviderStatsFromMetrics(providerId, metrics);
        }
      }

      for (const providerId of providerIdSet) {
        if (!result[providerId]) {
          result[providerId] = this.calculateProviderStatsFromMetrics(providerId, []);
        }
      }

      this.statsCache = result;
      this.statsCacheTimestamp = Date.now();

      const getAllStatsEndTime = Date.now();
      this.logDebug(
        `Retrieved all provider stats in ${getAllStatsEndTime - getAllStatsStartTime}ms`,
      );

      return result;
    } catch (error) {
      const getAllStatsEndTime = Date.now();
      this.logError(
        `Error getting all provider stats after ${getAllStatsEndTime - getAllStatsStartTime}ms:`,
        error,
      );
      throw error;
    }
  }

  getProviderRankings(metricsMap: Map<string, PerformanceMetric[]>): ProviderRanking[] {
    const allStats = this.getAllProviderStats(metricsMap);
    const rankings: ProviderRanking[] = [];

    for (const [providerId, stats] of Object.entries(allStats)) {
      rankings.push({
        providerId,
        score: this.calculatePerformanceScore(stats),
        stats,
      });
    }

    return rankings.sort((a, b) => b.score - a.score);
  }

  getBestPerformingProvider(metricsMap: Map<string, PerformanceMetric[]>): string | undefined {
    const rankings = this.getProviderRankings(metricsMap);
    return rankings.length > 0 ? rankings[0]?.providerId : undefined;
  }

  getProvidersByPerformance(
    metricsMap: Map<string, PerformanceMetric[]>,
    threshold: number = 80,
  ): {
    excellent: string[];
    good: string[];
    average: string[];
    poor: string[];
  } {
    const rankings = this.getProviderRankings(metricsMap);

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

  getWeightedScore(providerId: string, metrics: PerformanceMetric[]): number {
    const stats = this.calculateProviderStatsFromMetrics(providerId, metrics);
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

  invalidateCache(): void {
    this.statsCache = null;
    this.statsCacheTimestamp = 0;
  }
}
