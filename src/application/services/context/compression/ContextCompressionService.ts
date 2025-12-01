import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

interface FileStructure {
  imports: string[];
  exports: string[];
  keyFunctions: Array<{ name: string; content: string; startLine: number; endLine: number }>;
  classes: Array<{ name: string; content: string; startLine: number; endLine: number }>;
  otherCode: Array<{ content: string; startLine: number; endLine: number }>;
}

export class ContextCompressionService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ContextCompressionService");
  }

  async truncateFileIntelligently(
    content: string,
    maxTokens: number,
    targetFilePath: string,
  ): Promise<string> {
    if (content.length === 0) {
      return content;
    }

    const estimatedTokens = this.estimateTokenCount(content);
    if (estimatedTokens <= maxTokens) {
      return content;
    }

    this.logger.debug("Truncating file intelligently", {
      filePath: targetFilePath,
      originalTokens: estimatedTokens,
      maxTokens,
      compressionRatio: maxTokens / estimatedTokens,
    });

    const structure = this.extractFileStructure(content);

    const prioritizedSections: Array<{ content: string; priority: number }> = [];

    for (const imp of structure.imports) {
      prioritizedSections.push({ content: imp, priority: 10 });
    }

    for (const exp of structure.exports) {
      prioritizedSections.push({ content: exp, priority: 9 });
    }

    for (const func of structure.keyFunctions) {
      prioritizedSections.push({ content: func.content, priority: 8 });
    }

    for (const cls of structure.classes) {
      prioritizedSections.push({ content: cls.content, priority: 7 });
    }

    for (const other of structure.otherCode) {
      prioritizedSections.push({ content: other.content, priority: 1 });
    }

    prioritizedSections.sort((a, b) => b.priority - a.priority);

    let truncated = "";
    let tokenCount = 0;

    for (const section of prioritizedSections) {
      const sectionTokens = this.estimateTokenCount(section.content);
      if (tokenCount + sectionTokens <= maxTokens) {
        truncated += section.content + "\n";
        tokenCount += sectionTokens;
      } else {
        const remainingTokens = maxTokens - tokenCount;
        if (remainingTokens > 100 && section.priority >= 8) {
          const partialContent = this.truncateSection(section.content, remainingTokens);
          truncated += partialContent + "\n";
        }
        break;
      }
    }

    if (truncated.length === 0) {
      return content.slice(0, Math.floor((maxTokens / estimatedTokens) * content.length));
    }

    this.logger.debug("File truncated successfully", {
      filePath: targetFilePath,
      originalTokens: estimatedTokens,
      finalTokens: this.estimateTokenCount(truncated),
      compressionRatio: this.estimateTokenCount(truncated) / estimatedTokens,
    });

    return truncated.trim();
  }

  private extractFileStructure(content: string): FileStructure {
    const lines = content.split("\n");
    const structure: FileStructure = {
      imports: [],
      exports: [],
      keyFunctions: [],
      classes: [],
      otherCode: [],
    };

    let currentSection: { content: string; startLine: number; endLine: number } | null = null;
    let inComment = false;
    let braceDepth = 0;
    let inFunction = false;
    let inClass = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("/*")) {
        inComment = true;
      }
      if (trimmed.includes("*/")) {
        inComment = false;
      }
      if (inComment && !trimmed.startsWith("/*") && !trimmed.includes("*/")) {
        continue;
      }

      if (trimmed.startsWith("//")) {
        continue;
      }

      const importMatch = trimmed.match(
        /^(?:import|export\s+(?:type\s+)?\{[^}]*\}\s+from|export\s+\*\s+from|require\s*\()/,
      );
      if (importMatch) {
        structure.imports.push(line);
        continue;
      }

      const exportMatch = trimmed.match(
        /^export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)/,
      );
      if (exportMatch) {
        if (!currentSection) {
          currentSection = { content: line, startLine: i, endLine: i };
        } else {
          currentSection.content += "\n" + line;
          currentSection.endLine = i;
        }
        continue;
      }

      const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        if (currentSection && inClass) {
          structure.classes.push({
            name: classMatch[1],
            content: currentSection.content,
            startLine: currentSection.startLine,
            endLine: currentSection.endLine,
          });
        }
        currentSection = { content: line, startLine: i, endLine: i };
        inClass = true;
        braceDepth = 0;
        continue;
      }

      const functionMatch = trimmed.match(
        /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*[:=]\s*(?:async\s+)?\(|(\w+)\s*[:=]\s*(?:async\s+)?\()/,
      );
      if (functionMatch) {
        const funcName = functionMatch[1] || functionMatch[2] || functionMatch[3];
        if (currentSection && inFunction) {
          structure.keyFunctions.push({
            name: funcName || "anonymous",
            content: currentSection.content,
            startLine: currentSection.startLine,
            endLine: currentSection.endLine,
          });
        }
        currentSection = { content: line, startLine: i, endLine: i };
        inFunction = true;
        braceDepth = 0;
        continue;
      }

      if (currentSection) {
        currentSection.content += "\n" + line;
        currentSection.endLine = i;

        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        braceDepth += openBraces - closeBraces;

        if (braceDepth === 0 && (inFunction || inClass)) {
          if (inFunction) {
            structure.keyFunctions.push({
              name: "function",
              content: currentSection.content,
              startLine: currentSection.startLine,
              endLine: currentSection.endLine,
            });
            inFunction = false;
          }
          if (inClass) {
            structure.classes.push({
              name: "class",
              content: currentSection.content,
              startLine: currentSection.startLine,
              endLine: currentSection.endLine,
            });
            inClass = false;
          }
          currentSection = null;
        }
      } else if (trimmed.length > 0 && !currentSection) {
        currentSection = { content: line, startLine: i, endLine: i };
      }
    }

    if (currentSection && !inFunction && !inClass) {
      structure.otherCode.push({
        content: currentSection.content,
        startLine: currentSection.startLine,
        endLine: currentSection.endLine,
      });
    }

    return structure;
  }

  private truncateSection(content: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokenCount(content);
    if (estimatedTokens <= maxTokens) {
      return content;
    }

    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(content.length * ratio);

    const lines = content.split("\n");
    const targetLines = Math.floor(lines.length * ratio);

    if (targetLines < 1) {
      return lines[0] || "";
    }

    return lines.slice(0, targetLines).join("\n") + "\n// ... truncated ...";
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
