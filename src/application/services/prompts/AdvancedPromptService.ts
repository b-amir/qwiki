import { EventBus } from "@/events/EventBus";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { PromptQualityAnalyzer } from "@/application/services/prompts/PromptQualityAnalyzer";
import { AdaptivePromptHelpers } from "@/application/services/prompts/AdaptivePromptHelpers";
import { PromptSectionBuilder } from "@/application/services/prompts/PromptSectionBuilder";
import { ContextAnalysisService } from "@/application/services/context/ContextAnalysisService";
import { PromptQualityService } from "@/application/services/prompts/PromptQualityService";
import type { ProjectContext } from "@/domain/entities/Selection";
import type {
  ValidationResult,
  EffectivenessScore,
  TestCase,
  ComplexityAnalysis,
  WikiOutline,
  DocumentationType,
  ProviderVariants,
  DynamicPromptConfig,
} from "@/domain/entities/PromptEngineering";
import type { GenerateParams } from "@/llm/types";
import { WikiPromptBuilder } from "@/application/services/prompts/building/WikiPromptBuilder";
import { DynamicPromptGenerator } from "@/application/services/prompts/building/DynamicPromptGenerator";
import { PromptOptimizer } from "@/application/services/prompts/building/PromptOptimizer";
import { ComplexityAnalyzer } from "@/application/services/prompts/analysis/ComplexityAnalyzer";
import { PromptOutlineGenerator } from "@/application/services/prompts/analysis/PromptOutlineGenerator";

export class AdvancedPromptService {
  private logger: Logger;
  private qualityAnalyzer: PromptQualityAnalyzer;
  private adaptiveHelpers: AdaptivePromptHelpers;
  private sectionBuilder: PromptSectionBuilder;
  private dynamicPromptGenerator: DynamicPromptGenerator;
  private promptOptimizer: PromptOptimizer;
  private complexityAnalyzer: ComplexityAnalyzer;
  private outlineGenerator: PromptOutlineGenerator;

  constructor(
    private loggingService: LoggingService,
    private contextAnalysisService?: ContextAnalysisService,
    private eventBus?: EventBus,
    private promptQualityService?: PromptQualityService,
  ) {
    this.logger = createLogger("AdvancedPromptService");
    this.qualityAnalyzer = new PromptQualityAnalyzer();
    this.adaptiveHelpers = new AdaptivePromptHelpers();
    this.sectionBuilder = new PromptSectionBuilder();
    this.dynamicPromptGenerator = new DynamicPromptGenerator(this.sectionBuilder);
    this.promptOptimizer = new PromptOptimizer();
    this.complexityAnalyzer = new ComplexityAnalyzer();
    this.outlineGenerator = new PromptOutlineGenerator();
  }

  static buildWikiPrompt(params: GenerateParams): string {
    return WikiPromptBuilder.buildWikiPrompt(params);
  }

  async generateDynamicPrompt(config: DynamicPromptConfig): Promise<string> {
    return this.dynamicPromptGenerator.generateDynamicPrompt(config);
  }

  async validatePromptQuality(prompt: string, context?: ProjectContext): Promise<ValidationResult> {
    if (this.promptQualityService && context) {
      try {
        const qualityResult = await this.promptQualityService.runQualityAssurance(prompt, context);
        this.logger.debug("Prompt quality validated via PromptQualityService", {
          passed: qualityResult.passed,
          overallScore: qualityResult.report.overallScore,
          suggestionCount: qualityResult.suggestions.length,
        });

        if (!qualityResult.passed && qualityResult.suggestions.length > 0) {
          this.logger.warn("Prompt quality issues detected", {
            suggestions: qualityResult.suggestions.map((s) => s.description),
          });
        }

        const validationErrors: string[] = [];
        if (!qualityResult.passed) {
          validationErrors.push("Prompt quality below threshold");
        }

        return {
          isValid: validationErrors.length === 0,
          errors: validationErrors,
          warnings: qualityResult.suggestions.map((s) => s.description),
        };
      } catch (error) {
        this.logger.warn("Prompt quality service failed, falling back to basic validation", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!prompt || prompt.trim().length === 0) {
      errors.push("Prompt is empty");
    }

    if (prompt.length < 50) {
      warnings.push("Prompt is very short, may lack context");
    }

    if (prompt.length > 10000) {
      warnings.push("Prompt is very long, may exceed token limits");
    }

    if (!prompt.includes("documentation") && !prompt.includes("document")) {
      warnings.push("Prompt may not clearly specify documentation task");
    }

    if (!prompt.includes("```") && !prompt.includes("code")) {
      warnings.push("Prompt may not include code section");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async optimizePromptForProvider(prompt: string, provider: string): Promise<string> {
    return this.promptOptimizer.optimizePromptForProvider(prompt, provider);
  }

  async testPromptEffectiveness(
    prompt: string,
    testCases: TestCase[],
  ): Promise<EffectivenessScore> {
    return this.qualityAnalyzer.calculateEffectivenessScore(prompt);
  }

  async analyzeCodeComplexity(content: string): Promise<ComplexityAnalysis> {
    return this.complexityAnalyzer.analyzeCodeComplexity(content);
  }

  async determineOptimalOutline(context: ProjectContext): Promise<WikiOutline> {
    return this.outlineGenerator.determineOptimalOutline(context);
  }

  async generateContextualInstructions(context: ProjectContext): Promise<string> {
    return this.outlineGenerator.generateContextualInstructions(context);
  }

  async createProviderSpecificVariants(basePrompt: string): Promise<ProviderVariants> {
    return this.promptOptimizer.createProviderSpecificVariants(basePrompt);
  }

  async adaptPromptToLanguage(prompt: string, language: string): Promise<string> {
    return this.promptOptimizer.adaptPromptToLanguage(prompt, language);
  }

  async filterIrrelevantSections(
    outline: WikiOutline,
    context: ProjectContext,
  ): Promise<WikiOutline> {
    return this.outlineGenerator.filterIrrelevantSections(outline, context);
  }

  private detectDocumentationType(content: string): DocumentationType {
    return this.adaptiveHelpers.detectDocumentationType(content);
  }

  private generateTechStackInfo(context: ProjectContext): string {
    return this.adaptiveHelpers.generateTechStackInfo(context);
  }

  private createImprovementSuggestions(context: ProjectContext): string {
    return this.adaptiveHelpers.createImprovementSuggestions(context);
  }

  private generateBestPracticesInfo(language: string, framework?: string): string {
    return this.adaptiveHelpers.generateBestPracticesInfo(language, framework);
  }

  private createSyntaxSection(language: string, complexity: number): string {
    return this.adaptiveHelpers.createSyntaxSection(language, complexity);
  }

  private generateSummaryRequirements(context: ProjectContext): string {
    return this.adaptiveHelpers.generateSummaryRequirements(context);
  }

  private createInDepthRequirements(context: ProjectContext): string {
    return this.adaptiveHelpers.createInDepthRequirements(context);
  }
}
