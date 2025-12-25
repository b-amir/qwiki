import { PerformanceMonitorService } from "@/infrastructure/services/performance/PerformanceMonitorService";
import { QualityMetricsService } from "@/infrastructure/services/performance/QualityMetricsService";
import { UXMetricsService } from "@/infrastructure/services/performance/UXMetricsService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export interface UnifiedMetrics {
  performance: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowestEndpoint?: string;
  };
  quality: {
    averageQualityScore: number;
    totalGenerations: number;
    qualityTrend: "improving" | "declining" | "stable";
  };
  ux: {
    averageLoadTime: number;
    userInteractions: number;
    errorCount: number;
  };
  timestamp: string;
}

export class GetAllMetricsCommand {
  private logger: Logger;

  constructor(
    private performanceMonitor: PerformanceMonitorService,
    private qualityMetrics: QualityMetricsService,
    private uxMetrics: UXMetricsService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("GetAllMetricsCommand");
  }

  async execute(): Promise<UnifiedMetrics> {
    this.logger.debug("Gathering unified metrics");

    const perfStats = this.performanceMonitor.getAllStats();

    const qualityMetrics = this.qualityMetrics.getQualityMetrics();
    const avgQualityScore = this.qualityMetrics.getAverageQualityScore();

    const uxMetrics = this.uxMetrics.getUXMetrics();
    const avgTimeToFirstResult = this.uxMetrics.getAverageTimeToFirstResult();

    const allQualityScores = [
      ...qualityMetrics.documentationQuality,
      ...qualityMetrics.userSatisfaction,
    ];

    const perfStatsArray = Object.values(perfStats);
    const totalOps = perfStatsArray.reduce((sum, s) => sum + s.count, 0);
    const avgResponse =
      perfStatsArray.length > 0
        ? perfStatsArray.reduce((sum, s) => sum + s.averageDuration, 0) / perfStatsArray.length
        : 0;

    const unified: UnifiedMetrics = {
      performance: {
        totalRequests: totalOps,
        averageResponseTime: avgResponse,
        errorRate: 0,
        slowestEndpoint:
          perfStatsArray.length > 0
            ? Object.entries(perfStats).reduce(
                (max, [name, stats]) =>
                  stats.maxDuration > (perfStats[max]?.maxDuration || 0) ? name : max,
                Object.keys(perfStats)[0] || "",
              )
            : undefined,
      },
      quality: {
        averageQualityScore: avgQualityScore,
        totalGenerations: allQualityScores.length,
        qualityTrend: this.determineQualityTrend(allQualityScores),
      },
      ux: {
        averageLoadTime: avgTimeToFirstResult,
        userInteractions: uxMetrics.timeToFirstResult.length + uxMetrics.featureDiscovery.length,
        errorCount: uxMetrics.errorRecovery.length,
      },
      timestamp: new Date().toISOString(),
    };

    this.logger.info("Unified metrics gathered", {
      performance: totalOps,
      quality: allQualityScores.length,
      ux: uxMetrics.timeToFirstResult.length,
    });

    return unified;
  }

  private determineQualityTrend(recentScores: number[]): "improving" | "declining" | "stable" {
    if (recentScores.length < 2) return "stable";

    const firstHalf = recentScores.slice(0, Math.floor(recentScores.length / 2));
    const secondHalf = recentScores.slice(Math.floor(recentScores.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;

    if (diff > 0.05) return "improving";
    if (diff < -0.05) return "declining";
    return "stable";
  }
}
