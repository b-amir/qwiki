import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../../infrastructure/services/LoggingService";
import type { CodeStructure, ComplexityScore } from "./shared-types";

export class ComplexityCalculationService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("ComplexityCalculationService", loggingService);
  }

  estimateContextComplexity(
    snippet: string,
    structure: CodeStructure,
    lines?: string[],
  ): ComplexityScore {
    const linesArray = lines || snippet.split("\n");
    const functionCount = structure.functions.length;
    const classCount = structure.classes.length;
    const interfaceCount = structure.interfaces.length;
    const maxNestingDepth = this.calculateMaxNestingDepth(snippet);

    const cyclomatic = this.calculateCyclomaticComplexity(structure);
    const cognitive = this.calculateCognitiveComplexity(snippet, structure, linesArray);
    const halstead = this.calculateHalsteadComplexity(snippet, structure, linesArray);

    return {
      overall: cyclomatic * 0.3 + cognitive * 0.4 + halstead.volume * 0.2 + maxNestingDepth * 0.1,
      cyclomatic,
      cognitive,
      halstead: {
        volume: halstead.volume,
        difficulty: halstead.difficulty,
        effort: halstead.effort,
      },
      lines: linesArray.length,
      functions: functionCount,
      classes: classCount,
      interfaces: interfaceCount,
    };
  }

  calculateMaxNestingDepth(snippet: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of snippet) {
      if (char === "{") currentDepth++;
      if (char === "}") currentDepth--;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    return maxDepth;
  }

  calculateCyclomaticComplexity(structure: CodeStructure): number {
    let complexity = 1;

    for (const func of structure.functions) {
      complexity += func.parameters.length + 1;
    }

    for (const cls of structure.classes) {
      complexity += cls.methods.length + cls.properties.length + 1;
    }

    return complexity;
  }

  calculateCognitiveComplexity(
    snippet: string,
    structure: CodeStructure,
    lines?: string[],
  ): number {
    const linesArray = lines || snippet.split("\n");
    let complexity = 0;

    for (let i = 0; i < linesArray.length; i++) {
      const line = linesArray[i];

      if (
        line.includes("if") ||
        line.includes("switch") ||
        line.includes("for") ||
        line.includes("while")
      ) {
        complexity += 1;
      }

      if (line.includes("try") || line.includes("catch")) {
        complexity += 1;
      }

      if (line.includes("&&") || line.includes("||")) {
        complexity += 1;
      }
    }

    return complexity;
  }

  calculateHalsteadComplexity(
    snippet: string,
    structure: CodeStructure,
    lines?: string[],
  ): { volume: number; difficulty: number; effort: number } {
    const linesArray = lines || snippet.split("\n");
    const operatorCounts = new Map<string, number>();
    const operandCounts = new Map<string, number>();

    for (const line of linesArray) {
      const lineOperators = this.extractHalsteadOperators(line);
      const lineOperands = this.extractHalsteadOperands(line);

      for (const op of lineOperators) {
        operatorCounts.set(op, (operatorCounts.get(op) || 0) + 1);
      }
      for (const op of lineOperands) {
        operandCounts.set(op, (operandCounts.get(op) || 0) + 1);
      }
    }

    const n1 = operatorCounts.size;
    const n2 = operandCounts.size;
    const N1 = Array.from(operatorCounts.values()).reduce((sum, count) => sum + count, 0);
    const N2 = Array.from(operandCounts.values()).reduce((sum, count) => sum + count, 0);

    const volume = (N1 + N2) * Math.log2(n1 + n2 || 1);
    const difficulty = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0;
    const effort = volume * difficulty;

    return { volume, difficulty, effort };
  }

  private extractHalsteadOperators(line: string): string[] {
    const operators: string[] = [];
    const operatorRegex = /([-+*/%=<>!&|^~?:]+)/g;
    let match;

    while ((match = operatorRegex.exec(line)) !== null) {
      operators.push(match[1].trim());
    }

    return operators;
  }

  private extractHalsteadOperands(line: string): string[] {
    const operands: string[] = [];
    const operandRegex = /(\b\w+\b)(?=\s*[;,=(){}[\]:]|$)/g;
    const keywords = new Set([
      "if",
      "else",
      "for",
      "while",
      "do",
      "switch",
      "case",
      "break",
      "continue",
      "return",
      "function",
      "class",
      "interface",
      "type",
      "const",
      "let",
      "var",
      "import",
      "export",
      "default",
      "from",
      "as",
      "new",
      "this",
      "super",
      "extends",
      "implements",
      "private",
      "public",
      "protected",
      "static",
      "readonly",
      "async",
      "await",
      "try",
      "catch",
      "finally",
      "throw",
      "delete",
      "in",
      "of",
      "instanceof",
      "typeof",
      "void",
      "null",
      "undefined",
      "true",
      "false",
    ]);

    let match;
    while ((match = operandRegex.exec(line)) !== null) {
      const operand = match[1].trim();
      if (!keywords.has(operand) && !/^\d+$/.test(operand)) {
        operands.push(operand);
      }
    }

    return operands;
  }
}
