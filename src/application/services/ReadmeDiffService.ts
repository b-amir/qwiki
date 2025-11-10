import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import type { ReadmePreview, SectionChange } from "../../domain/entities/ReadmeUpdate";

export interface ReadmeChangeSummary {
  added: number;
  updated: number;
  removed: number;
  preserved: number;
}

export class ReadmeDiffService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ReadmeDiffService");
  }

  generatePreview(original: string, updated: string): ReadmePreview {
    const originalLines = original.split("\n");
    const updatedLines = updated.split("\n");

    const changes = this.detectSectionChanges(originalLines, updatedLines);
    const warnings = this.generateWarnings(changes);

    return {
      original,
      updated,
      changes,
      warnings,
    };
  }

  private detectSectionChanges(originalLines: string[], updatedLines: string[]): SectionChange[] {
    const changes: SectionChange[] = [];
    const originalSections = this.extractSections(originalLines);
    const updatedSections = this.extractSections(updatedLines);

    const originalSectionMap = new Map(originalSections.map((s) => [s.name.toLowerCase(), s]));
    const updatedSectionMap = new Map(updatedSections.map((s) => [s.name.toLowerCase(), s]));

    for (const [name, updatedSection] of updatedSectionMap.entries()) {
      const originalSection = originalSectionMap.get(name);

      if (!originalSection) {
        changes.push({
          section: updatedSection.name,
          action: "added",
          content: updatedSection.content,
        });
      } else if (originalSection.content.trim() !== updatedSection.content.trim()) {
        changes.push({
          section: updatedSection.name,
          action: "updated",
          content: updatedSection.content,
        });
      } else {
        changes.push({
          section: updatedSection.name,
          action: "preserved",
          content: updatedSection.content,
        });
      }
    }

    for (const [name, originalSection] of originalSectionMap.entries()) {
      if (!updatedSectionMap.has(name)) {
        changes.push({
          section: originalSection.name,
          action: "removed",
          content: originalSection.content,
        });
      }
    }

    return changes.sort((a, b) => {
      const order = { added: 0, updated: 1, preserved: 2, removed: 3 };
      return order[a.action] - order[b.action];
    });
  }

  private extractSections(lines: string[]): Array<{ name: string; content: string }> {
    const sections: Array<{ name: string; content: string }> = [];
    let currentSection: { name: string; content: string } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          name: headingMatch[2].trim(),
          content: line + "\n",
        };
      } else if (currentSection) {
        currentSection.content += line + "\n";
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private generateWarnings(changes: SectionChange[]): string[] {
    const warnings: string[] = [];
    const removedCount = changes.filter((c) => c.action === "removed").length;
    const updatedCount = changes.filter((c) => c.action === "updated").length;

    if (removedCount > 0) {
      warnings.push(
        `${removedCount} section${removedCount > 1 ? "s" : ""} will be removed from the README.`,
      );
    }

    if (updatedCount > 3) {
      warnings.push("Multiple sections will be significantly modified.");
    }

    return warnings;
  }

  summarizeChanges(changes: SectionChange[]): ReadmeChangeSummary {
    return {
      added: changes.filter((c) => c.action === "added").length,
      updated: changes.filter((c) => c.action === "updated").length,
      removed: changes.filter((c) => c.action === "removed").length,
      preserved: changes.filter((c) => c.action === "preserved").length,
    };
  }
}
