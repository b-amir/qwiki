import type { ProjectContext } from "../../../domain/entities/Selection";
import type { WikiGenerationRequest } from "../../../domain/entities/Wiki";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";

export interface ContextSuggestion {
  type: "filePath" | "relatedFiles" | "overview" | "projectStructure" | "examples";
  priority: "high" | "medium" | "low";
  message: string;
  actionable: string;
}

export interface ContextAnalysis {
  hasFilePath: boolean;
  hasRelatedFiles: boolean;
  hasOverview: boolean;
  hasProjectStructure: boolean;
  hasExamples: boolean;
  suggestions: ContextSuggestion[];
  contextCompleteness: number;
}

export class ContextSuggestionService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ContextSuggestionService", loggingService);
  }

  analyzeContext(request: WikiGenerationRequest, projectContext: ProjectContext): ContextAnalysis {
    const hasFilePath = Boolean(request.filePath);
    const hasRelatedFiles = Boolean(projectContext.related && projectContext.related.length > 0);
    const hasOverview = Boolean(
      projectContext.overview && projectContext.overview.trim().length > 0,
    );
    const hasProjectStructure = Boolean(
      projectContext.filesSample && projectContext.filesSample.length > 0,
    );
    const hasExamples = this.detectExamplesInSnippet(request.snippet);

    const suggestions = this.generateSuggestions(
      hasFilePath,
      hasRelatedFiles,
      hasOverview,
      hasProjectStructure,
      hasExamples,
      request,
      projectContext,
    );

    const contextCompleteness = this.calculateCompleteness(
      hasFilePath,
      hasRelatedFiles,
      hasOverview,
      hasProjectStructure,
      hasExamples,
    );

    this.logger.debug("Context analysis completed", {
      contextCompleteness,
      suggestionCount: suggestions.length,
      hasFilePath,
      hasRelatedFiles,
      hasOverview,
      hasProjectStructure,
    });

    return {
      hasFilePath,
      hasRelatedFiles,
      hasOverview,
      hasProjectStructure,
      hasExamples,
      suggestions,
      contextCompleteness,
    };
  }

  private generateSuggestions(
    hasFilePath: boolean,
    hasRelatedFiles: boolean,
    hasOverview: boolean,
    hasProjectStructure: boolean,
    hasExamples: boolean,
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
  ): ContextSuggestion[] {
    const suggestions: ContextSuggestion[] = [];

    if (!hasFilePath) {
      suggestions.push({
        type: "filePath",
        priority: "high",
        message: "File path is missing. This helps provide file-specific context.",
        actionable:
          "Ensure the code selection includes the file path for better context understanding.",
      });
    }

    if (!hasRelatedFiles && request.snippet.length > 100) {
      suggestions.push({
        type: "relatedFiles",
        priority: "high",
        message: "No related files detected. Related files help understand dependencies and usage.",
        actionable:
          "Include related files or ensure the project structure is indexed for better context.",
      });
    }

    if (!hasOverview && request.snippet.length > 200) {
      suggestions.push({
        type: "overview",
        priority: "medium",
        message: "Project overview is missing. Overview helps understand the project context.",
        actionable: "Add project overview or ensure package.json and project files are accessible.",
      });
    }

    if (!hasProjectStructure) {
      suggestions.push({
        type: "projectStructure",
        priority: "medium",
        message:
          "Project structure information is limited. Structure helps understand code organization.",
        actionable: "Ensure project files are indexed and accessible for better context.",
      });
    }

    if (!hasExamples && this.isComplexCode(request.snippet)) {
      suggestions.push({
        type: "examples",
        priority: "low",
        message:
          "Code snippet may benefit from example usage. Examples improve documentation quality.",
        actionable: "Consider including example usage or test cases for better documentation.",
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private calculateCompleteness(
    hasFilePath: boolean,
    hasRelatedFiles: boolean,
    hasOverview: boolean,
    hasProjectStructure: boolean,
    hasExamples: boolean,
  ): number {
    const weights = {
      filePath: 0.25,
      relatedFiles: 0.25,
      overview: 0.2,
      projectStructure: 0.2,
      examples: 0.1,
    };

    let score = 0;
    if (hasFilePath) score += weights.filePath;
    if (hasRelatedFiles) score += weights.relatedFiles;
    if (hasOverview) score += weights.overview;
    if (hasProjectStructure) score += weights.projectStructure;
    if (hasExamples) score += weights.examples;

    return Math.min(1.0, Math.round(score * 100) / 100);
  }

  private detectExamplesInSnippet(snippet: string): boolean {
    const examplePatterns = [
      /example/i,
      /usage/i,
      /test/i,
      /sample/i,
      /demo/i,
      /\/\/\s*(example|usage|demo)/i,
      /\/\*\s*(example|usage|demo)/i,
    ];

    return examplePatterns.some((pattern) => pattern.test(snippet));
  }

  private isComplexCode(snippet: string): boolean {
    const complexityIndicators = [
      /function|class|interface|type\s+\w+\s*=/,
      /\{[\s\S]{50,}\}/,
      /\([\s\S]{30,}\)/,
      /async|await|promise/i,
      /import|export|require/,
    ];

    const matchCount = complexityIndicators.filter((pattern) => pattern.test(snippet)).length;
    return matchCount >= 2;
  }
}
