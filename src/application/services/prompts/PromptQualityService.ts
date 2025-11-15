import { EventBus } from "@/events/EventBus";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import type { ProjectContext } from "@/domain/entities/Selection";
import type { QualityThreshold, QualityAssuranceResult } from "@/domain/entities/PromptEngineering";
import { PromptQualityAnalyzer } from "@/application/services/prompts/PromptQualityAnalyzer";
import { QualityReportGenerator } from "@/application/services/prompts/quality/QualityReportGenerator";
import { ImprovementSuggestionGenerator } from "@/application/services/prompts/quality/ImprovementSuggestionGenerator";
import { PromptSafetyChecker } from "@/application/services/prompts/quality/PromptSafetyChecker";
import { PromptStructureValidator } from "@/application/services/prompts/quality/PromptStructureValidator";
import { PromptClarityAnalyzer } from "@/application/services/prompts/quality/PromptClarityAnalyzer";
import { PromptSpecificityAnalyzer } from "@/application/services/prompts/quality/PromptSpecificityAnalyzer";
import { PromptConsistencyChecker } from "@/application/services/prompts/quality/PromptConsistencyChecker";

export class PromptQualityService {
  private logger: Logger;
  private readonly qualityThresholds: QualityThreshold = {
    minimum: 0.6,
    target: 0.8,
    maximum: 1.0,
  };
  private reportGenerator: QualityReportGenerator;
  private suggestionGenerator: ImprovementSuggestionGenerator;
  private safetyChecker: PromptSafetyChecker;
  private structureValidator: PromptStructureValidator;
  private clarityAnalyzer: PromptClarityAnalyzer;
  private specificityAnalyzer: PromptSpecificityAnalyzer;
  private consistencyChecker: PromptConsistencyChecker;

  constructor(
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("PromptQualityService");
    const qualityAnalyzer = new PromptQualityAnalyzer();
    this.structureValidator = new PromptStructureValidator();
    this.clarityAnalyzer = new PromptClarityAnalyzer(qualityAnalyzer);
    this.specificityAnalyzer = new PromptSpecificityAnalyzer(qualityAnalyzer);
    this.consistencyChecker = new PromptConsistencyChecker(qualityAnalyzer);
    this.reportGenerator = new QualityReportGenerator(this.qualityThresholds);
    this.suggestionGenerator = new ImprovementSuggestionGenerator();
    this.safetyChecker = new PromptSafetyChecker();
  }

  async validatePromptStructure(prompt: string): Promise<any> {
    return this.structureValidator.validatePromptStructure(prompt);
  }

  async testPromptClarity(prompt: string): Promise<any> {
    return this.clarityAnalyzer.testPromptClarity(prompt);
  }

  async measurePromptSpecificity(prompt: string): Promise<any> {
    return this.specificityAnalyzer.measurePromptSpecificity(prompt);
  }

  async checkPromptConsistency(prompt: string): Promise<any> {
    return this.consistencyChecker.checkPromptConsistency(prompt);
  }

  async generateQualityReport(prompt: string): Promise<any> {
    return this.reportGenerator.generateQualityReport(prompt);
  }

  async suggestImprovements(prompt: string, metrics: any): Promise<any> {
    return this.suggestionGenerator.suggestImprovements(prompt, metrics);
  }

  private validateOutputRequirements(prompt: string): any {
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
