import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { PromptQualityAnalyzer } from "./prompt/PromptQualityAnalyzer";
import type { ProjectContext } from "../../domain/entities/Selection";
import type {
  QualityMetrics,
  PromptTestResult,
  QualityThreshold,
  StructureValidation,
  ClarityScore,
  SpecificityScore,
  ConsistencyScore,
  QualityReport,
  ImprovementSuggestion,
  AmbiguityAnalysis,
  SafetyCheck,
  OutputValidation,
  QualityAssuranceResult,
} from "../../domain/entities/PromptEngineering";

export class PromptQualityService {
  private logger: Logger;
  private qualityAnalyzer: PromptQualityAnalyzer;
  private readonly qualityThresholds: QualityThreshold = {
    minimum: 0.6,
    target: 0.8,
    maximum: 1.0,
  };

  constructor(
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("PromptQualityService");
    this.qualityAnalyzer = new PromptQualityAnalyzer();
  }

  async validatePromptStructure(prompt: string): Promise<StructureValidation> {
    const hasInstructions = /instruction|require|must|should|output/i.test(prompt);
    const hasContext = /context|project|file/i.test(prompt);
    const hasCodeSection = /```|code|snippet/i.test(prompt);
    const hasOutputFormat = /markdown|format|output|section/i.test(prompt);

    const issues: string[] = [];
    if (!hasInstructions) issues.push("Missing clear instructions");
    if (!hasContext) issues.push("No context information provided");
    if (!hasCodeSection) issues.push("No code section identified");
    if (!hasOutputFormat) issues.push("No output format specification");

    return {
      isValid: issues.length === 0,
      hasInstructions,
      hasContext,
      hasCodeSection,
      hasOutputFormat,
      issues,
    };
  }

  async testPromptClarity(prompt: string): Promise<ClarityScore> {
    const hasClearInstructions = /instruction|require|must|should/i.test(prompt);
    const hasStructure = /section|format|heading|structure/i.test(prompt);
    const hasExamples = /example|sample|demonstration/i.test(prompt);

    const issues: string[] = [];
    if (!hasClearInstructions) issues.push("Instructions are not clearly stated");
    if (!hasStructure) issues.push("Prompt lacks clear structure");
    if (!hasExamples) issues.push("No examples provided");

    const score = this.qualityAnalyzer.measureClarity(prompt);

    return {
      score,
      hasClearInstructions,
      hasStructure,
      hasExamples,
      issues,
    };
  }

  async measurePromptSpecificity(prompt: string): Promise<SpecificityScore> {
    const specificTerms =
      prompt.match(
        /\b(component|function|class|interface|method|property|parameter|return|type|implementation)\b/gi,
      ) || [];
    const vagueTerms = prompt.match(/\b(thing|stuff|something|anything|somehow)\b/gi) || [];

    const issues: string[] = [];
    if (vagueTerms.length > 0) {
      issues.push(`Found ${vagueTerms.length} vague term(s): ${vagueTerms.slice(0, 3).join(", ")}`);
    }
    if (specificTerms.length < 3) {
      issues.push("Prompt lacks sufficient specific technical terms");
    }

    const score = this.qualityAnalyzer.measureSpecificity(prompt);

    return {
      score,
      specificTerms: specificTerms.slice(0, 10),
      vagueTerms,
      issues,
    };
  }

  async checkPromptConsistency(prompt: string): Promise<ConsistencyScore> {
    const formatConsistency =
      /section|format|heading/i.test(prompt) && /markdown|code block|output/i.test(prompt);
    const terminologyConsistency = this.checkTerminologyConsistency(prompt);

    const issues: string[] = [];
    if (!formatConsistency) issues.push("Inconsistent formatting instructions");
    if (!terminologyConsistency) issues.push("Inconsistent terminology usage");

    const score = this.qualityAnalyzer.measureConsistency(prompt);

    return {
      score,
      formatConsistency,
      terminologyConsistency,
      issues,
    };
  }

  async generateQualityReport(prompt: string): Promise<QualityReport> {
    const structure = await this.validatePromptStructure(prompt);
    const clarity = await this.testPromptClarity(prompt);
    const specificity = await this.measurePromptSpecificity(prompt);
    const consistency = await this.checkPromptConsistency(prompt);

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

  async suggestImprovements(
    prompt: string,
    metrics: QualityMetrics,
  ): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    if (metrics.clarity < 0.7) {
      suggestions.push({
        type: "clarity",
        priority: metrics.clarity < 0.5 ? "high" : "medium",
        description: "Prompt lacks clarity. Add explicit instructions and examples.",
        suggestedChange: "Add sections like 'OUTPUT REQUIREMENTS' and 'FORMATTING'",
      });
    }

    if (metrics.completeness < 0.7) {
      suggestions.push({
        type: "completeness",
        priority: metrics.completeness < 0.5 ? "high" : "medium",
        description: "Prompt is incomplete. Include context, code, and output format.",
      });
    }

    if (metrics.specificity < 0.7) {
      suggestions.push({
        type: "specificity",
        priority: metrics.specificity < 0.5 ? "high" : "medium",
        description: "Prompt is too vague. Use specific technical terms.",
        suggestedChange: "Replace vague terms with specific technical terminology",
      });
    }

    if (metrics.consistency < 0.7) {
      suggestions.push({
        type: "consistency",
        priority: metrics.consistency < 0.5 ? "high" : "medium",
        description: "Prompt has inconsistencies. Standardize formatting and terminology.",
      });
    }

    const structure = await this.validatePromptStructure(prompt);
    if (!structure.isValid) {
      suggestions.push({
        type: "structure",
        priority: "high",
        description: "Prompt structure has issues: " + structure.issues.join(", "),
      });
    }

    const safetyCheck = this.checkForHarmfulInstructions(prompt);
    if (!safetyCheck.isSafe) {
      suggestions.push({
        type: "safety",
        priority: "high",
        description: "Potential safety issues detected: " + safetyCheck.warnings.join(", "),
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private analyzePromptAmbiguity(prompt: string): AmbiguityAnalysis {
    const ambiguousPatterns = [
      /\b(may|might|could|possibly|perhaps|maybe)\b/gi,
      /\b(some|any|thing|stuff|something|anything)\b/gi,
      /\b(etc|and so on|and more)\b/gi,
    ];

    const ambiguousTerms: string[] = [];
    for (const pattern of ambiguousPatterns) {
      const matches = prompt.match(pattern);
      if (matches) ambiguousTerms.push(...matches);
    }

    const uniqueTerms = [...new Set(ambiguousTerms)];
    const score = Math.max(0, 1.0 - uniqueTerms.length * 0.1);

    return {
      ambiguousTerms: uniqueTerms,
      score,
      issues: uniqueTerms.length > 0 ? [`Found ${uniqueTerms.length} ambiguous term(s)`] : [],
    };
  }

  private checkForHarmfulInstructions(prompt: string): SafetyCheck {
    const harmfulPatterns = [
      /ignore\s+(errors|warnings|safety|security)/i,
      /bypass\s+(security|validation|checks)/i,
      /disable\s+(safety|security|validation)/i,
      /skip\s+(validation|checks|safety)/i,
    ];

    const harmfulPatternsFound: string[] = [];
    for (const pattern of harmfulPatterns) {
      if (pattern.test(prompt)) {
        harmfulPatternsFound.push(pattern.toString());
      }
    }

    const warnings: string[] = [];
    if (harmfulPatternsFound.length > 0) {
      warnings.push("Prompt may encourage unsafe practices");
    }

    return {
      isSafe: harmfulPatternsFound.length === 0,
      harmfulPatterns: harmfulPatternsFound,
      warnings,
    };
  }

  private validateOutputRequirements(prompt: string): OutputValidation {
    const hasFormatSpecification = /markdown|format|output|structure/i.test(prompt);
    const hasExample = /example|sample|demonstration/i.test(prompt);

    const issues: string[] = [];
    if (!hasFormatSpecification) issues.push("No output format specified");
    if (!hasExample) issues.push("No example output provided");

    return {
      isValid: hasFormatSpecification && hasExample,
      hasFormatSpecification,
      hasExample,
      issues,
    };
  }

  private measureContextUtilization(prompt: string, context: ProjectContext): number {
    if (!context) return 0;

    let utilization = 0;
    if (context.rootName && prompt.includes(context.rootName)) utilization += 0.3;
    if (
      context.overview &&
      prompt.toLowerCase().includes(context.overview.toLowerCase().substring(0, 20))
    )
      utilization += 0.3;
    if (context.related && context.related.length > 0 && /related|file|component/i.test(prompt))
      utilization += 0.4;

    return Math.min(1.0, utilization);
  }

  private checkTerminologyConsistency(prompt: string): boolean {
    const formatTerms = prompt.match(/(markdown|md|format|output)/gi) || [];
    const codeTerms = prompt.match(/(code|snippet|source|implementation)/gi) || [];

    return formatTerms.length > 0 && codeTerms.length > 0;
  }

  async runQualityAssurance(
    prompt: string,
    context: ProjectContext,
  ): Promise<QualityAssuranceResult> {
    this.logger.debug("Running quality assurance for prompt");

    const report = await this.generateQualityReport(prompt);
    const suggestions = await this.suggestImprovements(prompt, report.metrics);
    const contextUtilization = this.measureContextUtilization(prompt, context);

    const passed = report.passed && contextUtilization > 0.5;
    const canProceed = passed || report.overallScore >= this.qualityThresholds.minimum * 0.9;

    if (this.eventBus) {
      this.eventBus.publish("prompt-quality-assessed", {
        prompt,
        report,
        suggestions,
        passed,
        canProceed,
      });
    }

    return {
      passed,
      report,
      suggestions,
      canProceed,
    };
  }
}
