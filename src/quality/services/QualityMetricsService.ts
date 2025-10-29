import {
  QualityMetrics,
  MetricThresholds,
  QualityReport,
  DocumentationContext,
  QualityTrend,
  TimePeriod,
  TrendDirection,
} from "../types/QualityTypes";
import {
  IssueType,
  IssueSeverity,
  RecommendationType,
  Priority,
  Impact,
  Effort,
} from "../types/QualityTypes";

export class QualityMetricsService {
  private thresholds: MetricThresholds = {
    minimum: 0.6,
    target: 0.8,
    maximum: 1.0,
  };

  setMetricThresholds(thresholds: MetricThresholds): void {
    this.thresholds = thresholds;
  }

  async calculateMetrics(content: string, context: DocumentationContext): Promise<QualityMetrics> {
    const clarity = await this.calculateClarity(content, context);
    const completeness = await this.calculateCompleteness(content, context);
    const accuracy = await this.calculateAccuracy(content, context);
    const consistency = await this.calculateConsistency(content, context);

    const overall = (clarity + completeness + accuracy + consistency) / 4;

    return {
      clarity,
      completeness,
      accuracy,
      consistency,
      overall,
    };
  }

  async scoreQuality(content: string, context: DocumentationContext): Promise<number> {
    const metrics = await this.calculateMetrics(content, context);
    return metrics.overall;
  }

  async generateQualityReport(
    content: string,
    context: DocumentationContext,
  ): Promise<QualityReport> {
    const metrics = await this.calculateMetrics(content, context);
    const issues = await this.identifyIssues(content, metrics);
    const recommendations = await this.generateRecommendations(content, metrics, issues);

    return {
      metrics,
      issues,
      recommendations,
      score: metrics.overall,
    };
  }

  async trackQualityTrend(projectId: string, timeframe: TimePeriod): Promise<QualityTrend> {
    const metrics = await this.getHistoricalMetrics(projectId, timeframe);
    const trend = this.calculateTrendDirection(metrics);
    const improvement = this.calculateImprovement(metrics);

    return {
      timeframe,
      metrics,
      trend,
      improvement,
    };
  }

  private async calculateClarity(content: string, context: DocumentationContext): Promise<number> {
    let score = 0.5;

    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    const avgSentenceLength =
      sentences.reduce((sum, s) => sum + s.split(" ").length, 0) / sentences.length;

    if (avgSentenceLength >= 15 && avgSentenceLength <= 25) {
      score += 0.2;
    } else if (avgSentenceLength < 15) {
      score += 0.1;
    }

    const paragraphs = content.split("\n\n").filter((p) => p.trim().length > 0);
    if (paragraphs.length > 1) {
      score += 0.1;
    }

    const hasHeadings = /^#+\s/.test(content) || /^[A-Z][^.]*$/m.test(content);
    if (hasHeadings) {
      score += 0.1;
    }

    const complexWords = content.match(/\b\w{8,}\b/g) || [];
    const complexityRatio = complexWords.length / content.split(/\s+/).length;
    if (complexityRatio < 0.15) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private async calculateCompleteness(
    content: string,
    context: DocumentationContext,
  ): Promise<number> {
    let score = 0.3;

    const hasExamples = /```|`[^`]+`|example/i.test(content);
    if (hasExamples) score += 0.2;

    const hasParameters = /parameter|arg|option/i.test(content);
    if (hasParameters) score += 0.1;

    const hasReturnValue = /return|returns|output/i.test(content);
    if (hasReturnValue) score += 0.1;

    const hasErrors = /error|exception|throw/i.test(content);
    if (hasErrors) score += 0.1;

    const hasDescription = content.length > 100;
    if (hasDescription) score += 0.1;

    const hasUsage = /usage|how to|use/i.test(content);
    if (hasUsage) score += 0.1;

    return Math.min(score, 1.0);
  }

  private async calculateAccuracy(content: string, context: DocumentationContext): Promise<number> {
    let score = 0.7;

    const hasVersionNumbers = /\d+\.\d+(\.\d+)?/.test(content);
    if (!hasVersionNumbers) score += 0.1;

    const hasConsistentNaming = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/.test(content);
    if (hasConsistentNaming) score += 0.1;

    const hasCodeBlocks = /```[\s\S]*?```/.test(content);
    if (hasCodeBlocks) score += 0.1;

    return Math.min(score, 1.0);
  }

  private async calculateConsistency(
    content: string,
    context: DocumentationContext,
  ): Promise<number> {
    let score = 0.6;

    const terms = content.toLowerCase().split(/\s+/);
    const uniqueTerms = new Set(terms);
    const consistencyRatio = uniqueTerms.size / terms.length;

    if (consistencyRatio > 0.3 && consistencyRatio < 0.7) {
      score += 0.2;
    }

    const formatting = content.match(/(\*\*|__|`|```)/g) || [];
    if (formatting.length > 0) {
      score += 0.1;
    }

    const headings = content.match(/^#+\s/gm) || [];
    if (headings.length > 1) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private async identifyIssues(content: string, metrics: QualityMetrics): Promise<any[]> {
    const issues = [];

    if (metrics.clarity < this.thresholds.minimum) {
      issues.push({
        type: IssueType.CLARITY,
        description: "Content lacks clarity",
        severity: IssueSeverity.MEDIUM,
        suggestion: "Consider rephrasing complex sentences",
      });
    }

    if (metrics.completeness < this.thresholds.minimum) {
      issues.push({
        type: IssueType.COMPLETENESS,
        description: "Content may be incomplete",
        severity: IssueSeverity.HIGH,
        suggestion: "Add examples and parameter descriptions",
      });
    }

    if (metrics.accuracy < this.thresholds.minimum) {
      issues.push({
        type: IssueType.ACCURACY,
        description: "Potential accuracy issues detected",
        severity: IssueSeverity.CRITICAL,
        suggestion: "Verify all technical details and code examples",
      });
    }

    if (metrics.consistency < this.thresholds.minimum) {
      issues.push({
        type: IssueType.CONSISTENCY,
        description: "Inconsistent formatting or terminology",
        severity: IssueSeverity.LOW,
        suggestion: "Standardize terminology and formatting",
      });
    }

    return issues;
  }

  private async generateRecommendations(
    content: string,
    metrics: QualityMetrics,
    issues: any[],
  ): Promise<any[]> {
    const recommendations = [];

    if (metrics.clarity < this.thresholds.target) {
      recommendations.push({
        type: RecommendationType.REPHRASE,
        description: "Simplify complex sentences for better readability",
        priority: Priority.MEDIUM,
        impact: Impact.MODERATE,
        effort: Effort.LOW,
      });
    }

    if (metrics.completeness < this.thresholds.target) {
      recommendations.push({
        type: RecommendationType.ADD_CONTENT,
        description: "Add code examples and usage scenarios",
        priority: Priority.HIGH,
        impact: Impact.SIGNIFICANT,
        effort: Effort.MODERATE,
      });
    }

    if (metrics.consistency < this.thresholds.target) {
      recommendations.push({
        type: RecommendationType.IMPROVE_STYLE,
        description: "Standardize formatting and terminology",
        priority: Priority.LOW,
        impact: Impact.MODERATE,
        effort: Effort.MINIMAL,
      });
    }

    return recommendations;
  }

  private async getHistoricalMetrics(
    projectId: string,
    timeframe: TimePeriod,
  ): Promise<QualityMetrics[]> {
    return [];
  }

  private calculateTrendDirection(metrics: QualityMetrics[]): TrendDirection {
    if (metrics.length < 2) return TrendDirection.STABLE;

    const firstScore = metrics[0].overall;
    const lastScore = metrics[metrics.length - 1].overall;
    const difference = lastScore - firstScore;

    if (Math.abs(difference) < 0.05) return TrendDirection.STABLE;
    if (difference > 0) return TrendDirection.IMPROVING;
    return TrendDirection.DECLINING;
  }

  private calculateImprovement(metrics: QualityMetrics[]): number {
    if (metrics.length < 2) return 0;

    const firstScore = metrics[0].overall;
    const lastScore = metrics[metrics.length - 1].overall;

    return ((lastScore - firstScore) / firstScore) * 100;
  }
}
