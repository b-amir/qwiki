import type {
  QualityMetrics,
  QualityReport,
  QualityThreshold,
  StructureValidation,
  ClarityScore,
  SpecificityScore,
  ConsistencyScore,
} from "@/domain/entities/PromptEngineering";
import { PromptQualityAnalyzer } from "@/application/services/prompts/PromptQualityAnalyzer";
import { PromptStructureValidator } from "@/application/services/prompts/quality/PromptStructureValidator";
import { PromptClarityAnalyzer } from "@/application/services/prompts/quality/PromptClarityAnalyzer";
import { PromptSpecificityAnalyzer } from "@/application/services/prompts/quality/PromptSpecificityAnalyzer";
import { PromptConsistencyChecker } from "@/application/services/prompts/quality/PromptConsistencyChecker";

export class QualityReportGenerator {
  private structureValidator: PromptStructureValidator;
  private clarityAnalyzer: PromptClarityAnalyzer;
  private specificityAnalyzer: PromptSpecificityAnalyzer;
  private consistencyChecker: PromptConsistencyChecker;
  private qualityAnalyzer: PromptQualityAnalyzer;

  constructor(private qualityThresholds: QualityThreshold) {
    this.qualityAnalyzer = new PromptQualityAnalyzer();
    this.structureValidator = new PromptStructureValidator();
    this.clarityAnalyzer = new PromptClarityAnalyzer(this.qualityAnalyzer);
    this.specificityAnalyzer = new PromptSpecificityAnalyzer(this.qualityAnalyzer);
    this.consistencyChecker = new PromptConsistencyChecker(this.qualityAnalyzer);
  }

  async generateQualityReport(prompt: string): Promise<QualityReport> {
    const structure = await this.structureValidator.validatePromptStructure(prompt);
    const clarity = await this.clarityAnalyzer.testPromptClarity(prompt);
    const specificity = await this.specificityAnalyzer.measurePromptSpecificity(prompt);
    const consistency = await this.consistencyChecker.checkPromptConsistency(prompt);

    const metrics: QualityMetrics = {
      clarity: clarity.score,
      completeness: this.qualityAnalyzer.measureCompleteness(prompt),
      specificity: specificity.score,
      consistency: consistency.score,
    };

    const overallScore =
      (metrics.clarity + metrics.completeness + metrics.specificity + metrics.consistency) / 4;
    const passed = overallScore >= this.qualityThresholds.minimum;

    const recommendations: string[] = [];
    if (clarity.score < 0.7) {
      recommendations.push("Improve clarity by adding clear instructions and examples");
    }
    if (specificity.score < 0.7) {
      recommendations.push("Increase specificity by using more technical terms");
    }
    if (consistency.score < 0.7) {
      recommendations.push("Improve consistency in formatting and terminology");
    }
    if (structure.issues.length > 0) {
      recommendations.push("Fix structural issues: " + structure.issues.join(", "));
    }

    return {
      overallScore,
      metrics,
      structure,
      clarity,
      specificity,
      consistency,
      passed,
      recommendations,
    };
  }
}
