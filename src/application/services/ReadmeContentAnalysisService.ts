import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export interface ContentAnalysisResult {
  score: number;
  isBoilerplate: boolean;
  isUserContributed: boolean;
  genericSectionCount: number;
  placeholderCount: number;
  uniqueContentRatio: number;
  hasCodeExamples: boolean;
  customSections: string[];
}

export class ReadmeContentAnalysisService {
  private logger: Logger;
  private readonly genericSections = new Set([
    "installation",
    "usage",
    "contributing",
    "license",
    "getting started",
    "requirements",
    "setup",
  ]);
  private readonly placeholderPatterns = [
    /\[Your Project Name\]/i,
    /\[Project Description\]/i,
    /TODO/i,
    /FIXME/i,
    /PLACEHOLDER/i,
    /YOUR_NAME/i,
    /YOUR_EMAIL/i,
  ];
  private readonly templateLinkPatterns = [
    /github\.com\/.*\/template/i,
    /github\.com\/.*\/boilerplate/i,
    /github\.com\/.*\/starter/i,
  ];

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ReadmeContentAnalysisService", loggingService);
  }

  analyze(content: string): ContentAnalysisResult {
    if (!content || content.trim().length < 100) {
      return {
        score: 0.0,
        isBoilerplate: true,
        isUserContributed: false,
        genericSectionCount: 0,
        placeholderCount: 0,
        uniqueContentRatio: 0,
        hasCodeExamples: false,
        customSections: [],
      };
    }

    const genericSectionCount = this.countGenericSections(content);
    const placeholderCount = this.countPlaceholders(content);
    const uniqueContentRatio = this.calculateUniqueContentRatio(content);
    const hasCodeExamples = this.hasCodeExamples(content);
    const customSections = this.extractCustomSections(content);

    const score = this.calculateScore({
      genericSectionCount,
      placeholderCount,
      uniqueContentRatio,
      hasCodeExamples,
      customSections: customSections.length,
    });

    const isBoilerplate = score < 0.3;
    const isUserContributed = score > 0.7;

    this.logger.debug("Content analysis completed", {
      score,
      isBoilerplate,
      isUserContributed,
      genericSectionCount,
      placeholderCount,
    });

    return {
      score,
      isBoilerplate,
      isUserContributed,
      genericSectionCount,
      placeholderCount,
      uniqueContentRatio,
      hasCodeExamples,
      customSections,
    };
  }

  private countGenericSections(content: string): number {
    const sectionPattern = /^#{1,3}\s+(.+)$/gm;
    const matches = content.matchAll(sectionPattern);
    let count = 0;

    for (const match of matches) {
      const sectionName = match[1].toLowerCase().trim();
      if (this.genericSections.has(sectionName)) {
        count++;
      }
    }

    return count;
  }

  private countPlaceholders(content: string): number {
    let count = 0;
    for (const pattern of this.placeholderPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }

  private calculateUniqueContentRatio(content: string): number {
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return 0;
    }

    const uniqueLines = new Set(lines.map((line) => line.trim().toLowerCase()));
    const uniqueRatio = uniqueLines.size / lines.length;

    const hasTemplateLinks = this.templateLinkPatterns.some((pattern) => pattern.test(content));
    if (hasTemplateLinks) {
      return Math.max(0, uniqueRatio - 0.2);
    }

    return uniqueRatio;
  }

  private hasCodeExamples(content: string): boolean {
    const codeBlockPattern = /```[\s\S]{20,}```/;
    return codeBlockPattern.test(content);
  }

  private extractCustomSections(content: string): string[] {
    const sectionPattern = /^#{1,3}\s+(.+)$/gm;
    const matches = content.matchAll(sectionPattern);
    const customSections: string[] = [];

    for (const match of matches) {
      const sectionName = match[1].toLowerCase().trim();
      if (!this.genericSections.has(sectionName)) {
        customSections.push(match[1]);
      }
    }

    return customSections;
  }

  private calculateScore(metrics: {
    genericSectionCount: number;
    placeholderCount: number;
    uniqueContentRatio: number;
    hasCodeExamples: boolean;
    customSections: number;
  }): number {
    let score = 0.5;

    if (metrics.genericSectionCount >= 4) {
      score -= 0.3;
    } else if (metrics.genericSectionCount >= 2) {
      score -= 0.15;
    }

    if (metrics.placeholderCount >= 3) {
      score -= 0.3;
    } else if (metrics.placeholderCount >= 1) {
      score -= 0.1;
    }

    score += metrics.uniqueContentRatio * 0.3;

    if (metrics.hasCodeExamples) {
      score += 0.15;
    }

    if (metrics.customSections >= 2) {
      score += 0.2;
    } else if (metrics.customSections === 1) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }
}
