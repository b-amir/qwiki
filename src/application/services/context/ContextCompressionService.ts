import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { CodeExtractionService } from "@/application/services/context/relevance/CodeExtractionService";
import type {
  CompressionStrategy,
  CompressionStrategyConfig,
  CompressedContent,
  KeyInfo,
} from "@/domain/entities/ContextIntelligence";

export class ContextCompressionService {
  private logger: Logger;

  constructor(
    private loggingService: LoggingService,
    private codeExtractionService: CodeExtractionService,
  ) {
    this.logger = createLogger("ContextCompressionService");
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  async compressContent(
    content: string,
    strategy: CompressionStrategyConfig,
  ): Promise<CompressedContent> {
    const originalSize = content.length;
    let compressed = content;

    if (strategy.name === "none") {
      return {
        original: content,
        compressed: content,
        metadata: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1.0,
          strategy: "none",
          tokensSaved: 0,
        },
      };
    }

    if (strategy.name === "light") {
      compressed = this.removeRedundantCode(compressed);
      compressed = this.compressComments(compressed);
      compressed = this.compressImportStatements(compressed);
    } else if (strategy.name === "moderate") {
      compressed = this.removeRedundantCode(compressed);
      compressed = this.compressComments(compressed);
      compressed = this.compressImportStatements(compressed);
      compressed = this.preserveFunctionSignatures(compressed);
      compressed = this.preserveTypeDefinitions(compressed);
    } else if (strategy.name === "aggressive") {
      compressed = await this.preserveEssentialInformation(compressed, "auto");
      const keyInfo = await this.extractKeyInformation(compressed, "auto");
      const essentialContent = keyInfo
        .filter((info) => info.importance >= 0.7)
        .map((info) => info.value)
        .join("\n");
      compressed = essentialContent || compressed;
    }

    const compressedSize = compressed.length;
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1.0;
    const tokensSaved = Math.ceil((originalSize - compressedSize) / 4);

    return {
      original: content,
      compressed,
      metadata: {
        originalSize,
        compressedSize,
        compressionRatio,
        strategy: strategy.name,
        tokensSaved,
      },
    };
  }

  selectCompressionStrategy(fileType: string, importance: number): CompressionStrategyConfig {
    if (importance >= 0.9) {
      return { name: "none", ratio: 1.0, quality: 1.0 };
    }
    if (importance >= 0.7) {
      return { name: "light", ratio: 0.8, quality: 0.9 };
    }
    if (importance >= 0.5) {
      return { name: "moderate", ratio: 0.6, quality: 0.8 };
    }
    return { name: "aggressive", ratio: 0.4, quality: 0.6 };
  }

  async preserveEssentialInformation(content: string, fileType: string): Promise<string> {
    const keyInfo = await this.extractKeyInformation(content, fileType);
    const essentialParts: string[] = [];

    for (const info of keyInfo) {
      if (info.importance >= 0.5) {
        essentialParts.push(info.value);
      }
    }

    return essentialParts.join("\n\n");
  }

  async generateContentSummary(content: string, targetLength: number): Promise<string> {
    if (content.length <= targetLength) {
      return content;
    }

    const lines = content.split("\n");
    const keyInfo = await this.extractKeyInformation(content, "auto");
    const summary: string[] = [];

    let currentLength = 0;
    for (const info of keyInfo.sort((a, b) => b.importance - a.importance)) {
      if (currentLength + info.value.length <= targetLength) {
        summary.push(info.value);
        currentLength += info.value.length + 1;
      } else {
        break;
      }
    }

    if (summary.length === 0 && lines.length > 0) {
      return lines.slice(0, Math.floor(targetLength / 50)).join("\n");
    }

    return summary.join("\n");
  }

  async extractKeyInformation(content: string, fileType: string): Promise<KeyInfo[]> {
    return this.codeExtractionService.extractKeyInformation(content, fileType);
  }

  private removeRedundantCode(content: string): string {
    const lines = content.split("\n");
    const cleaned: string[] = [];
    let inCommentBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("/*")) {
        inCommentBlock = !trimmed.includes("*/");
        continue;
      }

      if (inCommentBlock) {
        if (trimmed.includes("*/")) {
          inCommentBlock = false;
        }
        continue;
      }

      if (trimmed.startsWith("//")) {
        continue;
      }

      if (trimmed.length === 0 && cleaned.length > 0) {
        const lastCleaned = cleaned[cleaned.length - 1];
        if (lastCleaned && lastCleaned.trim() === "") {
          continue;
        }
      }

      cleaned.push(line);
    }

    return cleaned.join("\n");
  }

  private compressComments(content: string): string {
    const lines = content.split("\n");
    const compressed: string[] = [];

    for (const line of lines) {
      const commentIndex = line.indexOf("//");
      if (commentIndex >= 0) {
        const codePart = line.substring(0, commentIndex).trimEnd();
        if (codePart.length > 0) {
          compressed.push(codePart);
        }
      } else {
        compressed.push(line);
      }
    }

    return compressed.join("\n");
  }

  private preserveFunctionSignatures(content: string): string {
    const lines = content.split("\n");
    const preserved: string[] = [];
    const functionSignaturePattern =
      /^(?:export\s+)?(?:async\s+)?function\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;  // Skip if undefined

      if (functionSignaturePattern.test(line)) {
        preserved.push(line.trimEnd() + " { ... }");
        let braceCount = 0;
        let inFunction = false;

        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          if (!currentLine) continue;  // Skip if undefined
          
          for (const char of currentLine) {
            if (char === "{") {
              braceCount++;
              inFunction = true;
            } else if (char === "}" ) {
              braceCount--;
              if (inFunction && braceCount === 0) {
                i = j;
                break;
              }
            }
          }
          if (inFunction && braceCount === 0) break;
        }
      } else {
        preserved.push(line);
      }
    }

    return preserved.join("\n");
  }

  private compressImportStatements(content: string): string {
    const lines = content.split("\n");
    const imports: string[] = [];
    const other: string[] = [];

    for (const line of lines) {
      if (/^import\s+.+\s+from\s+['"]/.test(line.trim())) {
        imports.push(line.trim());
      } else {
        other.push(line);
      }
    }

    if (imports.length > 5) {
      const grouped = this.groupImports(imports);
      return [...grouped, ...other].join("\n");
    }

    return content;
  }

  private groupImports(imports: string[]): string[] {
    const grouped = new Map<string, string[]>();

    for (const imp of imports) {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (match) {
        const source = match[1];
        if (source) {  // Check if match group exists
          if (!grouped.has(source)) {
            grouped.set(source, []);
          }
          const group = grouped.get(source);
          if (group) {  // Check if group exists before push
            group.push(imp);
          }
        }
      }
    }

    const result: string[] = [];
    for (const [source, importLines] of grouped.entries()) {
      if (importLines.length === 1) {
        const firstImport = importLines[0];
        if (firstImport) {  // Check if exists
          result.push(firstImport);
        }
      } else {
        const importsStr = importLines.map((imp) => {
          const match = imp.match(/import\s+(.+)\s+from/);
          return match && match[1] ? match[1] : "";
        });
        result.push(`import { ${importsStr.join(", ")} } from '${source}'`);
      }
    }

    return result;
  }

  private preserveTypeDefinitions(content: string): string {
    const lines = content.split("\n");
    const preserved: string[] = [];
    const typePattern = /^(?:export\s+)?(?:type|interface)\s+[a-zA-Z_][a-zA-Z0-9_]*/;

    for (const line of lines) {
      if (typePattern.test(line.trim())) {
        preserved.push(line);
        let braceCount = 0;
        let inType = false;
        let i = lines.indexOf(line);

        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          if (!currentLine) continue;  // Skip if undefined
          
          for (const char of currentLine) {
            if (char === "{") {
              braceCount++;
              inType = true;
            } else if (char === "}") {
              braceCount--;
              if (inType && braceCount === 0) {
                const lineAtJ = lines[j];
                if (lineAtJ) {  // Check before push
                  preserved.push(lineAtJ);
                }
                break;
              }
            }
            if (inType && braceCount > 0 && j > i) {
              preserved.push(currentLine);
            }
          }
          if (inType && braceCount === 0) break;
        }
      } else {
        preserved.push(line);
      }
    }

    return preserved.join("\n");
  }
}
