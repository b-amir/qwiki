import type { SavedWiki } from "./WikiStorageService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export interface WikiSummary {
  title: string;
  summary: string;
  hasCodeExamples: boolean;
  keyTerms: string[];
}

export class WikiSummarizationService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("WikiSummarizationService", loggingService);
  }

  summarizeExcludedWikis(excludedWikis: SavedWiki[]): string {
    if (excludedWikis.length === 0) {
      return "";
    }

    this.logger.debug(`Summarizing ${excludedWikis.length} excluded wikis`);

    const summaries = excludedWikis.map((wiki) => this.createWikiSummary(wiki));
    const summarySection = this.formatSummarySection(summaries);

    return summarySection;
  }

  private createWikiSummary(wiki: SavedWiki): WikiSummary {
    const firstParagraph = this.extractFirstParagraph(wiki.content);
    const codeExamples = this.extractCodeExamples(wiki.content);
    const keyTerms = this.extractKeyTerms(wiki.content);

    const summary = this.buildSummaryText(firstParagraph, codeExamples, keyTerms);

    return {
      title: wiki.title,
      summary,
      hasCodeExamples: codeExamples.length > 0,
      keyTerms,
    };
  }

  private extractFirstParagraph(content: string): string {
    const lines = content.split("\n");
    const firstNonEmptyLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        firstNonEmptyLines.push(trimmed);
        if (firstNonEmptyLines.length >= 3) {
          break;
        }
      }
    }

    return firstNonEmptyLines.join(" ").trim();
  }

  private extractCodeExamples(content: string): string[] {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const matches = content.match(codeBlockPattern);
    if (!matches) {
      return [];
    }

    return matches.slice(0, 2).map((match) => match.substring(0, 150));
  }

  private extractKeyTerms(content: string): string[] {
    const termPattern = /`([^`]+)`|function\s+(\w+)|class\s+(\w+)|interface\s+(\w+)/g;
    const terms = new Set<string>();
    let match;

    while ((match = termPattern.exec(content)) !== null && terms.size < 5) {
      const term = match[1] || match[2] || match[3] || match[4];
      if (term && term.length > 2 && term.length < 30) {
        terms.add(term);
      }
    }

    return Array.from(terms).slice(0, 5);
  }

  private buildSummaryText(
    firstParagraph: string,
    codeExamples: string[],
    keyTerms: string[],
  ): string {
    let summary = firstParagraph;

    if (codeExamples.length > 0) {
      summary += " Contains code examples.";
    }

    if (keyTerms.length > 0) {
      summary += ` Key concepts: ${keyTerms.join(", ")}.`;
    }

    if (summary.length > 200) {
      return summary.substring(0, 197) + "...";
    }

    return summary;
  }

  private formatSummarySection(summaries: WikiSummary[]): string {
    if (summaries.length === 0) {
      return "";
    }

    const summaryLines = [
      "## Summary of Additional Wikis",
      "",
      "The following wikis contain relevant documentation but were excluded from the main update due to token limits:",
      "",
    ];

    for (const summary of summaries) {
      summaryLines.push(`### ${summary.title}`);
      summaryLines.push(summary.summary);
      summaryLines.push("");
    }

    summaryLines.push(
      "Note: These wikis can be included in a future README update by processing in smaller batches.",
    );

    return summaryLines.join("\n");
  }
}
