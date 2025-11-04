import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export interface DocumentationQualityMetrics {
  completeness: number;
  clarity: number;
  structure: number;
  examples: number;
  codeReferences: number;
  overallScore: number;
}

export interface DocumentationQualityReport {
  metrics: DocumentationQualityMetrics;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export class DocumentationQualityService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("DocumentationQualityService", loggingService);
  }

  calculateQualityMetrics(content: string, snippet: string): DocumentationQualityMetrics {
    const completeness = this.measureCompleteness(content, snippet);
    const clarity = this.measureClarity(content);
    const structure = this.measureStructure(content);
    const examples = this.measureExamples(content);
    const codeReferences = this.measureCodeReferences(content, snippet);

    const overallScore =
      (completeness + clarity + structure + examples + codeReferences) / 5;

    this.logger.debug("Quality metrics calculated", {
      completeness,
      clarity,
      structure,
      examples,
      codeReferences,
      overallScore,
    });

    return {
      completeness,
      clarity,
      structure,
      examples,
      codeReferences,
      overallScore,
    };
  }

  generateQualityReport(
    content: string,
    snippet: string,
    metrics: DocumentationQualityMetrics,
  ): DocumentationQualityReport {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    if (metrics.completeness >= 0.7) {
      strengths.push("Documentation covers key aspects comprehensively");
    } else {
      weaknesses.push("Documentation may be missing important details");
      recommendations.push("Add more comprehensive coverage of functionality and use cases");
    }

    if (metrics.clarity >= 0.7) {
      strengths.push("Documentation is clear and easy to understand");
    } else {
      weaknesses.push("Documentation clarity could be improved");
      recommendations.push("Use simpler language and provide clearer explanations");
    }

    if (metrics.structure >= 0.7) {
      strengths.push("Documentation is well-structured with proper sections");
    } else {
      weaknesses.push("Documentation structure could be improved");
      recommendations.push("Organize content into clear sections with headings");
    }

    if (metrics.examples >= 0.7) {
      strengths.push("Documentation includes helpful examples");
    } else {
      weaknesses.push("Documentation lacks examples");
      recommendations.push("Add usage examples to illustrate how the code works");
    }

    if (metrics.codeReferences >= 0.7) {
      strengths.push("Documentation properly references code elements");
    } else {
      weaknesses.push("Code references could be more specific");
      recommendations.push("Include specific code element names and references");
    }

    return {
      metrics,
      strengths,
      weaknesses,
      recommendations,
    };
  }

  private measureCompleteness(content: string, snippet: string): number {
    const snippetSymbols = this.extractSymbols(snippet);
    const contentLower = content.toLowerCase();
    let referencedSymbols = 0;

    for (const symbol of snippetSymbols) {
      if (contentLower.includes(symbol.toLowerCase())) {
        referencedSymbols++;
      }
    }

    const symbolCoverage = snippetSymbols.length > 0 ? referencedSymbols / snippetSymbols.length : 1;

    const hasDescription = content.length > 100;
    const hasUsage = /usage|how to|example|how/i.test(content);
    const hasParameters = /parameter|argument|input|option/i.test(content);
    const hasReturn = /return|output|result/i.test(content);

    const sectionsScore = [hasDescription, hasUsage, hasParameters, hasReturn].filter(Boolean).length / 4;

    return Math.min(1.0, (symbolCoverage * 0.5 + sectionsScore * 0.5));
  }

  private measureClarity(content: string): number {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    let avgSentenceLength = 0;
    let complexSentences = 0;

    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/).length;
      avgSentenceLength += words;
      if (words > 25) complexSentences++;
    }

    avgSentenceLength /= sentences.length;
    const complexityRatio = complexSentences / sentences.length;

    const avgLengthScore = avgSentenceLength >= 10 && avgSentenceLength <= 20 ? 1.0 : 0.7;
    const complexityScore = 1.0 - Math.min(1.0, complexityRatio * 2);

    return (avgLengthScore + complexityScore) / 2;
  }

  private measureStructure(content: string): number {
    const headingPattern = /^#+\s+/gm;
    const headings = content.match(headingPattern) || [];
    const headingCount = headings.length;

    const hasMainHeading = /^#\s+/.test(content);
    const hasMultipleSections = headingCount >= 2;
    const hasListItems = /^\s*[-*+]|\d+\.\s+/m.test(content);
    const hasCodeBlocks = /```/.test(content);

    const structureElements = [
      hasMainHeading,
      hasMultipleSections,
      hasListItems,
      hasCodeBlocks,
    ].filter(Boolean).length;

    return structureElements / 4;
  }

  private measureExamples(content: string): number {
    const examplePatterns = [
      /example/i,
      /usage/i,
      /sample/i,
      /```[\s\S]+?```/g,
      /code[\s\S]{20,}/i,
    ];

    const matches = examplePatterns.filter((pattern) => pattern.test(content)).length;
    const codeBlocks = (content.match(/```/g) || []).length / 2;

    const exampleScore = Math.min(1.0, matches / 2);
    const codeBlockScore = Math.min(1.0, codeBlocks / 2);

    return (exampleScore + codeBlockScore) / 2;
  }

  private measureCodeReferences(content: string, snippet: string): number {
    const snippetSymbols = this.extractSymbols(snippet);
    if (snippetSymbols.length === 0) return 1.0;

    const contentLower = content.toLowerCase();
    let referencedCount = 0;

    for (const symbol of snippetSymbols) {
      if (contentLower.includes(symbol.toLowerCase())) {
        referencedCount++;
      }
    }

    return referencedCount / snippetSymbols.length;
  }

  private extractSymbols(code: string): string[] {
    const symbols = new Set<string>();
    const combinedPattern =
      /(?:(?:function|class|interface|type|const|let|var|export|async)\s+([A-Za-z0-9_]+)|([A-Za-z0-9_]+)\s*[=\(:])/g;

    let match;
    while ((match = combinedPattern.exec(code)) !== null) {
      const identifier = match[1] || match[2];
      if (identifier && identifier.length > 2) {
        symbols.add(identifier);
      }
    }

    return Array.from(symbols).slice(0, 10);
  }
}

