import {
  DocumentationQualityService,
  type DocumentationQualityMetrics,
} from "./DocumentationQualityService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export interface ImprovementSuggestion {
  type: "completeness" | "clarity" | "structure" | "examples" | "codeReferences";
  priority: "high" | "medium" | "low";
  message: string;
  actionable: string;
}

export interface ImprovementAnalysis {
  suggestions: ImprovementSuggestion[];
  priorityScore: number;
  canImprove: boolean;
}

export class DocumentationImprovementService {
  private logger: Logger;
  private qualityService: DocumentationQualityService;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("DocumentationImprovementService", loggingService);
    this.qualityService = new DocumentationQualityService(loggingService);
  }

  generateImprovements(
    content: string,
    snippet: string,
    metrics: DocumentationQualityMetrics,
  ): ImprovementAnalysis {
    const suggestions: ImprovementSuggestion[] = [];

    if (metrics.completeness < 0.7) {
      suggestions.push({
        type: "completeness",
        priority: metrics.completeness < 0.5 ? "high" : "medium",
        message: "Documentation is missing important details or sections",
        actionable: "Add sections covering parameters, return values, exceptions, and use cases",
      });
    }

    if (metrics.clarity < 0.7) {
      suggestions.push({
        type: "clarity",
        priority: metrics.clarity < 0.5 ? "high" : "medium",
        message: "Documentation could be clearer and easier to understand",
        actionable:
          "Simplify language, break down complex sentences, and use more direct explanations",
      });
    }

    if (metrics.structure < 0.7) {
      suggestions.push({
        type: "structure",
        priority: metrics.structure < 0.5 ? "high" : "medium",
        message: "Documentation structure needs improvement",
        actionable:
          "Organize content with clear headings, sections, and use lists for better readability",
      });
    }

    if (metrics.examples < 0.7) {
      suggestions.push({
        type: "examples",
        priority: metrics.examples < 0.4 ? "high" : "low",
        message: "Documentation lacks usage examples",
        actionable:
          "Add code examples showing how to use the documented code, including common use cases",
      });
    }

    if (metrics.codeReferences < 0.7) {
      suggestions.push({
        type: "codeReferences",
        priority: metrics.codeReferences < 0.5 ? "medium" : "low",
        message: "Documentation should reference specific code elements",
        actionable: "Include specific function names, class names, and parameters from the code",
      });
    }

    suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    const priorityScore = this.calculatePriorityScore(suggestions);
    const canImprove = suggestions.length > 0 && metrics.overallScore < 0.8;

    this.logger.debug("Improvement analysis completed", {
      suggestionCount: suggestions.length,
      priorityScore,
      canImprove,
      overallScore: metrics.overallScore,
    });

    return {
      suggestions,
      priorityScore,
      canImprove,
    };
  }

  private calculatePriorityScore(suggestions: ImprovementSuggestion[]): number {
    if (suggestions.length === 0) return 0;

    const priorityWeights = { high: 3, medium: 2, low: 1 };
    let totalWeight = 0;

    for (const suggestion of suggestions) {
      totalWeight += priorityWeights[suggestion.priority];
    }

    return Math.min(1.0, totalWeight / (suggestions.length * 3));
  }
}
