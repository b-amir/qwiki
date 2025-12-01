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
import type { WikiGenerationResult } from "@/domain/entities/Wiki";

interface PromptQualityMetrics {
  promptScore: number;
  generationQuality?: number;
  promptLength: number;
  contextLength: number;
  timestamp: number;
  providerId?: string;
  model?: string;
}

export class PromptQualityService {
  private logger: Logger;
  public readonly qualityThresholds: QualityThreshold = {
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

  async trackPromptQuality(
    prompt: string,
    promptScore: number,
    generationResult?: WikiGenerationResult,
    contextLength?: number,
    providerId?: string,
    model?: string,
  ): Promise<void> {
    const metrics: PromptQualityMetrics = {
      promptScore,
      promptLength: prompt.length,
      contextLength: contextLength || 0,
      timestamp: Date.now(),
      providerId,
      model,
    };

    if (generationResult) {
      const qualityMetrics = this.calculateGenerationQuality(generationResult);
      metrics.generationQuality = qualityMetrics.overallScore;

      const correlation = this.calculateCorrelation(promptScore, qualityMetrics.overallScore);

      this.logger.debug("Prompt quality tracked", {
        promptScore,
        generationQuality: qualityMetrics.overallScore,
        correlation,
        promptLength: prompt.length,
        contextLength: metrics.contextLength,
        providerId,
        model,
      });

      if (this.eventBus) {
        this.eventBus.publish("prompt-quality-tracked", {
          metrics,
          correlation,
        });
      }
    } else {
      this.logger.debug("Prompt quality tracked (no generation result)", {
        promptScore,
        promptLength: prompt.length,
        contextLength: metrics.contextLength,
        providerId,
        model,
      });
    }
  }

  private calculateGenerationQuality(result: WikiGenerationResult): {
    overallScore: number;
  } {
    if (!result.content) {
      return { overallScore: 0 };
    }

    const content = result.content;
    const hasHeading = /^#\s+/.test(content);
    const hasSections = (content.match(/^##\s+/gm) || []).length;
    const hasCodeBlocks = (content.match(/```/g) || []).length / 2;
    const hasExamples = /example|usage|sample/i.test(content);
    const length = content.length;

    let score = 0;
    if (hasHeading) score += 0.2;
    if (hasSections >= 3) score += 0.3;
    if (hasSections >= 5) score += 0.2;
    if (hasCodeBlocks > 0) score += 0.15;
    if (hasExamples) score += 0.15;
    if (length > 500 && length < 5000) score += 0.1;

    return { overallScore: Math.min(1.0, score) };
  }

  private calculateCorrelation(promptScore: number, generationScore: number): number {
    if (promptScore === 0 || generationScore === 0) return 0;
    const diff = Math.abs(promptScore - generationScore);
    return Math.max(0, 1 - diff);
  }
}
