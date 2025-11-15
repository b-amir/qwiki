import type {
  QualityMetrics,
  ImprovementSuggestion,
  StructureValidation,
  SafetyCheck,
} from "@/domain/entities/PromptEngineering";
import { PromptStructureValidator } from "@/application/services/prompts/quality/PromptStructureValidator";
import { PromptSafetyChecker } from "@/application/services/prompts/quality/PromptSafetyChecker";

export class ImprovementSuggestionGenerator {
  private structureValidator: PromptStructureValidator;
  private safetyChecker: PromptSafetyChecker;

  constructor() {
    this.structureValidator = new PromptStructureValidator();
    this.safetyChecker = new PromptSafetyChecker();
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

    const structure = await this.structureValidator.validatePromptStructure(prompt);
    if (!structure.isValid) {
      suggestions.push({
        type: "structure",
        priority: "high",
        description: "Prompt structure has issues: " + structure.issues.join(", "),
      });
    }

    const safetyCheck = this.safetyChecker.checkForHarmfulInstructions(prompt);
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
}
