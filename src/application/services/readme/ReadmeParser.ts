import type { ReadmeSection, CustomSection, ReadmeStructure } from "@/domain/entities/ReadmeUpdate";

export class ReadmeParser {
  extractSections(content: string): ReadmeSection[] {
    const sections: ReadmeSection[] = [];
    const lines = content.split("\n");
    let currentSection: ReadmeSection | null = null;
    let priority = 10;

    for (const line of lines) {
      const headingMatch = line.match(/^##+\s+(.+)$/);
      if (headingMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }

        const sectionName = headingMatch[1] ?? "Untitled";
        currentSection = {
          name: sectionName,
          content: line + "\n",
          priority: priority--,
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

  extractCustomSections(readme: string): CustomSection[] {
    const customSections: CustomSection[] = [];
    const lines = readme.split("\n");
    let inCustomSection = false;
    let currentSection: CustomSection | null = null;
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const headingMatch = line.match(/^##+\s+(.+)$/);

      if (headingMatch) {
        const heading = headingMatch[1] ?? "Untitled";
        const isPreservedSection = /^(custom|todo|notes?|changelog|license|copyright)/i.test(
          heading,
        );

        if (isPreservedSection) {
          if (currentSection) {
            currentSection.endLine = lineNumber - 1;
            customSections.push(currentSection);
          }

          currentSection = {
            name: heading,
            content: line + "\n",
            startLine: lineNumber,
            endLine: lineNumber,
          };
          inCustomSection = true;
        } else if (inCustomSection && currentSection) {
          currentSection.content += line + "\n";
          currentSection.endLine = lineNumber;
        } else {
          inCustomSection = false;
        }
      } else if (inCustomSection && currentSection) {
        currentSection.content += line + "\n";
        currentSection.endLine = lineNumber;
      } else {
        inCustomSection = false;
      }

      lineNumber++;
    }

    if (currentSection && inCustomSection) {
      customSections.push(currentSection);
    }

    return customSections;
  }

  analyzeStructure(content: string): ReadmeStructure {
    return {
      hasTitle: /^#\s/.test(content),
      hasDescription: /##\s*(description|about|overview)/i.test(content),
      hasInstallation: /##\s*installation/i.test(content),
      hasUsage: /##\s*usage/i.test(content),
      hasApiDocs: /##\s*(api|documentation|reference)/i.test(content),
      sections: this.extractSections(content).map((s) => s.name),
    };
  }
}
