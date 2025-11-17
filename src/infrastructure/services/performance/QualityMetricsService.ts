import { EventBus } from "@/events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { ServiceLimits } from "@/constants";
import type { PerformanceMetric } from "@/infrastructure/services/providers/ProviderPerformanceService";

export class QualityMetricsService {
  private qualityMetrics = new Map<string, { score: number; context?: Record<string, any> }[]>();
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("QualityMetricsService");
  }

  recordQualityMetric(
    metricType: "documentationQuality" | "userSatisfaction",
    score: number,
    context?: Record<string, any>,
  ): void {
    if (!this.qualityMetrics.has(metricType)) {
      this.qualityMetrics.set(metricType, []);
    }

    const metrics = this.qualityMetrics.get(metricType)!;
    metrics.push({ score, context });

    const maxMetrics = ServiceLimits.maxPerformanceMetrics;
    if (metrics.length > maxMetrics) {
      metrics.splice(0, metrics.length - maxMetrics);
    }

    const metric: PerformanceMetric = {
      providerId: "quality",
      timestamp: new Date(),
      duration: 0,
      success: score > 0.7,
      tokensUsed: 0,
    };

    this.eventBus.publish("qualityMetric", {
      metricType,
      score,
      context,
      timestamp: new Date(),
    });

    this.logger.debug(`Recorded ${metricType} metric`, { score, context });
  }

  getQualityMetrics(timeWindowMs: number = 3600000): {
    documentationQuality: number[];
    userSatisfaction: number[];
  } {
    const documentationQuality = (this.qualityMetrics.get("documentationQuality") || []).map(
      (m) => m.score,
    );
    const userSatisfaction = (this.qualityMetrics.get("userSatisfaction") || []).map(
      (m) => m.score,
    );

    return { documentationQuality, userSatisfaction };
  }

  getAverageQualityScore(timeWindowMs: number = 3600000): number {
    const { documentationQuality, userSatisfaction } = this.getQualityMetrics(timeWindowMs);
    const allScores = [...documentationQuality, ...userSatisfaction];

    if (allScores.length === 0) {
      return 0;
    }

    return allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  }

  clearMetrics(): void {
    this.qualityMetrics.clear();
  }

  dispose(): void {
    this.qualityMetrics.clear();
  }
}
