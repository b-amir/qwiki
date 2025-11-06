import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import type { KeyInfo } from "../../../domain/entities/ContextIntelligence";

export class CodeExtractionService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("CodeExtractionService");
  }

  async extractKeyInformation(content: string, fileType: string): Promise<KeyInfo[]> {
    const keyInfo: KeyInfo[] = [];
    const lines = content.split("\n");

    const functionPattern =
      /^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/;
    const classPattern = /^(?:export\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const interfacePattern = /^(?:export\s+)?interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const importPattern = /^import\s+.+from\s+['"].+['"]/;
    const exportPattern =
      /^export\s+(?:const|let|var|function|class|interface)\s+([a-zA-Z_][a-zA-Z0-9_]*)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpMatchArray | null = null;
      let type: KeyInfo["type"] = "variable";
      let importance = 0.5;

      if ((match = line.match(functionPattern))) {
        const extracted = this.extractFunction(lines, i);
        if (extracted) {
          keyInfo.push({
            type: "function",
            name: match[1],
            value: extracted.content,
            importance: 0.8,
            location: { line: i + 1, column: 0 },
          });
          i = extracted.endIndex;
        }
      } else if ((match = line.match(classPattern))) {
        const extracted = this.extractClass(lines, i);
        if (extracted) {
          keyInfo.push({
            type: "class",
            name: match[1],
            value: extracted.content,
            importance: 0.9,
            location: { line: i + 1, column: 0 },
          });
          i = extracted.endIndex;
        }
      } else if ((match = line.match(interfacePattern))) {
        const extracted = this.extractInterface(lines, i);
        if (extracted) {
          keyInfo.push({
            type: "interface",
            name: match[1],
            value: extracted.content,
            importance: 0.85,
            location: { line: i + 1, column: 0 },
          });
          i = extracted.endIndex;
        }
      } else if (importPattern.test(line)) {
        keyInfo.push({
          type: "import",
          name: line,
          value: line,
          importance: 0.6,
          location: { line: i + 1, column: 0 },
        });
      } else if ((match = line.match(exportPattern))) {
        keyInfo.push({
          type: "export",
          name: match[1] || line,
          value: line,
          importance: 0.7,
          location: { line: i + 1, column: 0 },
        });
      }
    }

    return keyInfo;
  }

  private extractFunction(
    lines: string[],
    startIndex: number,
  ): { content: string; endIndex: number } | null {
    let braceCount = 0;
    let inFunction = false;

    for (let j = startIndex; j < lines.length; j++) {
      const currentLine = lines[j];
      for (const char of currentLine) {
        if (char === "{") {
          braceCount++;
          inFunction = true;
        } else if (char === "}") {
          braceCount--;
          if (inFunction && braceCount === 0) {
            return {
              content: lines.slice(startIndex, j + 1).join("\n"),
              endIndex: j,
            };
          }
        }
      }
      if (inFunction && braceCount === 0) break;
    }

    return null;
  }

  private extractClass(
    lines: string[],
    startIndex: number,
  ): { content: string; endIndex: number } | null {
    let braceCount = 0;
    let inClass = false;

    for (let j = startIndex; j < lines.length; j++) {
      const currentLine = lines[j];
      for (const char of currentLine) {
        if (char === "{") {
          braceCount++;
          inClass = true;
        } else if (char === "}") {
          braceCount--;
          if (inClass && braceCount === 0) {
            return {
              content: lines.slice(startIndex, j + 1).join("\n"),
              endIndex: j,
            };
          }
        }
      }
      if (inClass && braceCount === 0) break;
    }

    return null;
  }

  private extractInterface(
    lines: string[],
    startIndex: number,
  ): { content: string; endIndex: number } | null {
    let braceCount = 0;
    let inInterface = false;

    for (let j = startIndex; j < lines.length; j++) {
      const currentLine = lines[j];
      for (const char of currentLine) {
        if (char === "{") {
          braceCount++;
          inInterface = true;
        } else if (char === "}") {
          braceCount--;
          if (inInterface && braceCount === 0) {
            return {
              content: lines.slice(startIndex, j + 1).join("\n"),
              endIndex: j,
            };
          }
        }
      }
      if (inInterface && braceCount === 0) break;
    }

    return null;
  }
}
