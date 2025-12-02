import { EventBus } from "@/events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { ServiceLimits } from "@/constants";
import type { PerformanceMetric } from "@/infrastructure/services/providers/ProviderPerformanceService";

interface UXMetricEntry {
  value: number;
  context?: Record<string, unknown>;
  timestamp: number;
}

interface CachedResultEvent {
  recoveryTime?: number;
  error?: { code?: string };
  providerId?: string;
}

interface OperationEvent {
  operation?: string;
}

export class UXMetricsService {
  private uxMetrics = new Map<string, UXMetricEntry[]>();
  private errorRateCounts = new Map<string, { errorCount: number; totalCount: number }>();
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("UXMetricsService");
    this.subscribeToEvents();
  }

  private subscribeToEvents(): void {
    this.eventBus.subscribe("cachedResultUsed", (event: CachedResultEvent) => {
      const recoveryTime = event.recoveryTime || 0;
      this.recordUXMetric("errorRecovery", recoveryTime, {
        errorCode: event.error?.code,
        providerId: event.providerId,
      });
    });

    this.eventBus.subscribe("operationFailed", (event: OperationEvent) => {
      this.recordErrorRate(event.operation || "unknown", 1, 1);
    });

    this.eventBus.subscribe("providerGenerationFailed", () => {
      this.recordErrorRate("providerGeneration", 1, 1);
    });

    this.eventBus.subscribe("generationSuccessful", () => {
      this.recordErrorRate("providerGeneration", 0, 1);
    });
  }

  recordUXMetric(
    metricType: "timeToFirstResult" | "featureDiscovery" | "errorRecovery",
    value: number,
    context?: Record<string, unknown>,
  ): void {
    if (!this.uxMetrics.has(metricType)) {
      this.uxMetrics.set(metricType, []);
    }

    const metrics = this.uxMetrics.get(metricType)!;
    metrics.push({ value, context, timestamp: Date.now() });

    const maxMetrics = ServiceLimits.maxPerformanceMetrics;
    if (metrics.length > maxMetrics) {
      metrics.splice(0, metrics.length - maxMetrics);
    }

    const metric: PerformanceMetric = {
      providerId: "ux",
      timestamp: new Date(),
      duration: value,
      success: true,
      tokensUsed: 0,
    };

    this.eventBus.publish("uxMetric", {
      metricType,
      value,
      context,
      timestamp: new Date(),
    });

    this.logger.debug(`Recorded ${metricType} UX metric`, { value, context });
  }

  recordErrorRate(operation: string, errorCount: number, totalCount: number): void {
    const existing = this.errorRateCounts.get(operation) || { errorCount: 0, totalCount: 0 };
    existing.errorCount += errorCount;
    existing.totalCount += totalCount;
    this.errorRateCounts.set(operation, existing);

    const errorRate = existing.totalCount > 0 ? existing.errorCount / existing.totalCount : 0;

    const metric: PerformanceMetric = {
      providerId: "errorRate",
      timestamp: new Date(),
      duration: 0,
      success: errorRate < 0.02,
      error: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
      tokensUsed: 0,
    };

    this.eventBus.publish("errorRate", {
      operation,
      errorCount: existing.errorCount,
      totalCount: existing.totalCount,
      errorRate,
      timestamp: new Date(),
    });

    this.logger.debug(`Recorded error rate for ${operation}`, {
      errorCount: existing.errorCount,
      totalCount: existing.totalCount,
      errorRate: `${(errorRate * 100).toFixed(2)}%`,
    });
  }

  getUXMetrics(timeWindowMs: number = 3600000): {
    timeToFirstResult: number[];
    featureDiscovery: number[];
    errorRecovery: number[];
  } {
    const cutoffTime = Date.now() - timeWindowMs;
    const timeToFirstResult = (this.uxMetrics.get("timeToFirstResult") || [])
      .filter((m) => m.timestamp > cutoffTime)
      .map((m) => m.value);
    const featureDiscovery = (this.uxMetrics.get("featureDiscovery") || [])
      .filter((m) => m.timestamp > cutoffTime)
      .map((m) => m.value);
    const errorRecovery = (this.uxMetrics.get("errorRecovery") || [])
      .filter((m) => m.timestamp > cutoffTime)
      .map((m) => m.value);

    return { timeToFirstResult, featureDiscovery, errorRecovery };
  }

  getErrorRate(operation: string, timeWindowMs: number = 3600000): number {
    const counts = this.errorRateCounts.get(operation);
    if (!counts || counts.totalCount === 0) {
      return 0;
    }

    return counts.errorCount / counts.totalCount;
  }

  getAverageTimeToFirstResult(timeWindowMs: number = 3600000): number {
    const { timeToFirstResult } = this.getUXMetrics(timeWindowMs);

    if (timeToFirstResult.length === 0) {
      return 0;
    }

    return timeToFirstResult.reduce((sum, time) => sum + time, 0) / timeToFirstResult.length;
  }

  clearMetrics(): void {
    this.uxMetrics.clear();
    this.errorRateCounts.clear();
  }

  dispose(): void {
    this.uxMetrics.clear();
    this.errorRateCounts.clear();
  }
}
