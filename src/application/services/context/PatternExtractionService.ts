import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import type { CodePattern } from "../ContextAnalysisService";
import { PatternType } from "../ContextAnalysisService";

export class PatternExtractionService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("PatternExtractionService", loggingService);
  }

  extractCodePatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];

    patterns.push(...this.extractFunctionPatterns(snippet, language));
    patterns.push(...this.extractClassPatterns(snippet, language));
    patterns.push(...this.extractInterfacePatterns(snippet, language));
    patterns.push(...this.extractImportPatterns(snippet, language));
    patterns.push(...this.extractVariablePatterns(snippet, language));
    patterns.push(...this.extractControlFlowPatterns(snippet, language));

    return patterns;
  }

  private extractFunctionPatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const functionRegex = this.getFunctionRegex(language);
      const matches = Array.from(line.matchAll(functionRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.FUNCTION_DECLARATION,
          name: match[1] || "anonymous",
          description: `Function declaration: ${match[0]}`,
          confidence: 0.9,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractClassPatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const classRegex = this.getClassRegex(language);
      const matches = Array.from(line.matchAll(classRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.CLASS_DECLARATION,
          name: match[1] || "anonymous",
          description: `Class declaration: ${match[0]}`,
          confidence: 0.9,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractInterfacePatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const interfaceRegex = this.getInterfaceRegex(language);
      const matches = Array.from(line.matchAll(interfaceRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.INTERFACE_DECLARATION,
          name: match[1] || "unnamed",
          description: `Interface declaration: ${match[0]}`,
          confidence: 0.9,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractImportPatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const importRegex = this.getImportRegex(language);
      const matches = Array.from(line.matchAll(importRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.IMPORT_STATEMENT,
          name: match[2] || match[3] || "unknown",
          description: `Import statement: ${match[0]}`,
          confidence: 0.8,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractVariablePatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const variableRegex = this.getVariableRegex(language);
      const matches = Array.from(line.matchAll(variableRegex) || []);

      for (const match of matches) {
        patterns.push({
          type: PatternType.VARIABLE_DECLARATION,
          name: match[1] || "unnamed",
          description: `Variable declaration: ${match[0]}`,
          confidence: 0.7,
          location: { line: i, column: line.indexOf(match[0]) },
        });
      }
    }

    return patterns;
  }

  private extractControlFlowPatterns(snippet: string, language: string): CodePattern[] {
    const patterns: CodePattern[] = [];
    const lines = snippet.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (
        line.includes("if") ||
        line.includes("switch") ||
        line.includes("for") ||
        line.includes("while")
      ) {
        patterns.push({
          type: PatternType.CONDITIONAL,
          name: "control-flow",
          description: `Control flow statement: ${line.substring(0, 50)}`,
          confidence: 0.8,
          location: { line: i, column: 0 },
        });
      }

      if (line.includes("try") || line.includes("catch")) {
        patterns.push({
          type: PatternType.ERROR_HANDLING,
          name: "error-handling",
          description: `Error handling: ${line.substring(0, 50)}`,
          confidence: 0.8,
          location: { line: i, column: 0 },
        });
      }

      if (line.includes("await")) {
        patterns.push({
          type: PatternType.ASYNC_AWAIT,
          name: "async-await",
          description: `Async operation: ${line.substring(0, 50)}`,
          confidence: 0.8,
          location: { line: i, column: 0 },
        });
      }
    }

    return patterns;
  }

  getFunctionRegex(language: string): RegExp {
    this.logger.debug("Getting function regex for language:", language);
    switch (language) {
      case "typescript":
      case "javascript":
        const tsJsRegex =
          /(?:function\s+(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*(?:=>|\{))|(?:const\s+(\w+)\s*=\s*(?:\([^)]*\))\s*(?::\s*\w+)?\s*(?:=>|\{))|(?:let\s+(\w+)\s*=\s*(?:\([^)]*\))\s*(?::\s*\w+)?\s*(?:=>|\{))|(?:var\s+(\w+)\s*=\s*(?:\([^)]*\))\s*(?::\s*\w+)?\s*(?:=>|\{))/g;
        this.logger.debug("TypeScript/JavaScript function regex:", tsJsRegex);
        return tsJsRegex;
      case "python":
        const pythonRegex =
          /(?:def\s+(\w+)\s*\([^)]*\)\s*:)|(?:class\s+(\w+)\s*\([^)]*\)\s*:)|(?:async\s+def\s+(\w+)\s*\([^)]*\)\s*:)/g;
        this.logger.debug("Python function regex:", pythonRegex);
        return pythonRegex;
      case "java":
      case "csharp":
        const classPattern =
          /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?class\s+(\w+)\s*(?:\([^)]*\))?\s*\{/g;
        const interfacePattern =
          /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?interface\s+(\w+)\s*(?:\([^)]*\))?\s*\{/g;
        const enumPattern =
          /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?enum\s+(\w+)\s*\{/g;
        const methodPattern =
          /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?(\w+)\s+(\w+)\s*(?:\([^)]*\))\s*[;{]/g;

        const javaCSharpRegex = new RegExp(
          [
            classPattern.source,
            interfacePattern.source,
            enumPattern.source,
            methodPattern.source,
          ].join("|"),
          "g",
        );

        this.logger.debug("Java/C# function regex:", javaCSharpRegex);
        return javaCSharpRegex;
      default:
        const defaultRegex = /function\s+(\w+)\s*\([^)]*\)/g;
        this.logger.debug("Default function regex:", defaultRegex);
        return defaultRegex;
    }
  }

  getClassRegex(language: string): RegExp {
    this.logger.debug("Getting class regex for language:", language);
    switch (language) {
      case "typescript":
      case "javascript":
        const tsClassRegex =
          /(?:class\s+(\w+)\s*(?:extends\s+(\w+))?\s*(?:implements\s+([^\{]+))?\s*\{)/g;
        this.logger.debug("TypeScript class regex:", tsClassRegex);
        return tsClassRegex;
      case "python":
        const pyClassRegex = /class\s+(\w+)\s*(?:\([^)]*\))?\s*(?::\s*([^\n]+))?/g;
        this.logger.debug("Python class regex:", pyClassRegex);
        return pyClassRegex;
      case "java":
      case "csharp":
        const javaClassRegex =
          /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?(?:class\s+(\w+)\s*(?:extends\s+(\w+))?\s*(?:implements\s+([^\{]+))?\s*\{)/g;
        this.logger.debug("Java/C# class regex:", javaClassRegex);
        return javaClassRegex;
      default:
        const defaultClassRegex =
          /class\s+(\w+)\s*(?:extends\s+(\w+))?\s*(?:implements\s+([^\{]+))?\s*\{/g;
        this.logger.debug("Default class regex:", defaultClassRegex);
        return defaultClassRegex;
    }
  }

  getInterfaceRegex(language: string): RegExp {
    this.logger.debug("Getting interface regex for language:", language);
    switch (language) {
      case "typescript":
      case "javascript":
        const tsInterfaceRegex = /interface\s+(\w+)\s*(?:extends\s+([^\{]+))?\s*\{/g;
        this.logger.debug("TypeScript interface regex:", tsInterfaceRegex);
        return tsInterfaceRegex;
      case "python":
        const pyInterfaceRegex =
          /(?:class\s+(\w+)\s*(?:\([^)]*\))?\s*:)?\s*interface\s+(\w+)\s*(?:\([^)]*\))?\s*\{/g;
        this.logger.debug("Python interface regex:", pyInterfaceRegex);
        return pyInterfaceRegex;
      default:
        const defaultInterfaceRegex = /interface\s+(\w+)\s*(?:extends\s+([^\{]+))?\s*\{/g;
        this.logger.debug("Default interface regex:", defaultInterfaceRegex);
        return defaultInterfaceRegex;
    }
  }

  getImportRegex(language: string): RegExp {
    this.logger.debug("Getting import regex for language:", language);
    switch (language) {
      case "typescript":
      case "javascript":
        const tsImportRegex =
          /(?:import\s+(?:\*\s+as\s+)?([^\s]+)\s+from\s+['"]([^'"]+)['"]|import\s+(?:\*\s+as\s+)?([^\s]+)\s*from\s+([^\s]+)\s*;|import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"])/g;
        this.logger.debug("TypeScript import regex:", tsImportRegex);
        return tsImportRegex;
      case "python":
        const pyImportRegex = /(?:from\s+([^\s]+)\s+import\s+(.+)|import\s+([^\s]+))/g;
        this.logger.debug("Python import regex:", pyImportRegex);
        return pyImportRegex;
      default:
        const defaultImportRegex = /import\s+([^\s]+)/g;
        this.logger.debug("Default import regex:", defaultImportRegex);
        return defaultImportRegex;
    }
  }

  getExportRegex(language: string): RegExp {
    switch (language) {
      case "typescript":
      case "javascript":
        return /export\s+(?:default\s+)?(?:class\s+(\w+)|function\s+(\w+)|interface\s+(\w+)|type\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/g;
      default:
        return /export\s+(?:default\s+)?(\w+)/g;
    }
  }

  getTypeRegex(language: string): RegExp {
    switch (language) {
      case "typescript":
        return /type\s+(\w+)\s*=\s*(?:\([^)]*\))?\s*[:=>]/g;
      default:
        return /type\s+(\w+)\s*=\s*([^;]+)/g;
    }
  }

  getVariableRegex(language: string): RegExp {
    switch (language) {
      case "typescript":
      case "javascript":
        return /(?:const|let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=\s*[^;]+/g;
      case "python":
        return /(\w+)\s*=\s*[^=]+/g;
      case "java":
      case "csharp":
        return /(?:public\s+|private\s+|protected\s+|static\s+)*(?:final\s+)?(?:\w+\s+)+(\w+)\s*(?:=\s*[^;]+)?;/g;
      default:
        return /(?:const|let|var)\s+(\w+)\s*=\s*[^;]+/g;
    }
  }
}
