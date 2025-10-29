import type { Command } from "./Command";
import type { EventBus } from "../../events";
import { QualityMetricsService } from "../../quality/services/QualityMetricsService";
import { Complexity, Audience, DocumentationPurpose } from "../../quality/types/QualityTypes";

export interface CalculateQualityMetricsPayload {
  content: string;
  context: {
    codeType: string;
    language: string;
    complexity: Complexity;
    audience: Audience;
    purpose: DocumentationPurpose;
  };
}

export class CalculateQualityMetricsCommand implements Command<CalculateQualityMetricsPayload> {
  constructor(
    private eventBus: EventBus,
    private qualityMetricsService: QualityMetricsService,
  ) {}

  async execute(payload: CalculateQualityMetricsPayload): Promise<void> {
    try {
      const metrics = await this.qualityMetricsService.calculateMetrics(
        payload.content,
        payload.context,
      );

      const qualityScore = await this.qualityMetricsService.scoreQuality(
        payload.content,
        payload.context,
      );

      const qualityReport = await this.qualityMetricsService.generateQualityReport(
        payload.content,
        payload.context,
      );

      await this.eventBus.publish("qualityMetricsCalculated", {
        metrics,
        qualityScore,
        qualityReport,
        timestamp: new Date(),
      });
    } catch (error) {
      await this.eventBus.publish("error", {
        message: `Failed to calculate quality metrics: ${(error as Error).message}`,
        code: "CALCULATE_QUALITY_METRICS_ERROR",
        suggestion: "Check if the content and context parameters are valid",
      });
      throw error;
    }
  }
}
