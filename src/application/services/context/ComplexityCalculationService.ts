import { LoggingService } from "../../../infrastructure";
import type { CodeStructure, ComplexityScore } from "./shared-types";

export class ComplexityCalculationService {
  private readonly serviceName = "ComplexityCalculationService";

  constructor(private loggingService: LoggingService) {}

  estimateContextComplexity(snippet: string, structure: CodeStructure): ComplexityScore {
    const lines = snippet.split("\n");
    const functionCount = structure.functions.length;
    const classCount = structure.classes.length;
    const interfaceCount = structure.interfaces.length;
    const maxNestingDepth = this.calculateMaxNestingDepth(snippet);

    const cyclomatic = this.calculateCyclomaticComplexity(structure);
    const cognitive = this.calculateCognitiveComplexity(snippet, structure);
    const halstead = this.calculateHalsteadComplexity(snippet, structure);

    return {
      overall: cyclomatic * 0.3 + cognitive * 0.4 + halstead.volume * 0.2 + maxNestingDepth * 0.1,
      cyclomatic,
      cognitive,
      halstead: {
        volume: halstead.volume,
        difficulty: halstead.difficulty,
        effort: halstead.effort,
      },
      lines: lines.length,
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

  calculateCognitiveComplexity(snippet: string, structure: CodeStructure): number {
    const lines = snippet.split("\n");
    let complexity = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

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
  ): { volume: number; difficulty: number; effort: number } {
    const lines = snippet.split("\n");
    const operators = new Set<string>();
    const operands = new Set<string>();

    for (const line of lines) {
      const lineOperators = this.extractHalsteadOperators(line);
      const lineOperands = this.extractHalsteadOperands(line);

      lineOperators.forEach((op) => operators.add(op));
      lineOperands.forEach((op) => operands.add(op));
    }

    const n1 = operators.size;
    const n2 = operands.size;
    const N1 = Array.from(operators).reduce(
      (count, op) => count + (snippet.match(new RegExp(`\\b${op}\\b`, "g")) || []).length,
      0,
    );
    const N2 = Array.from(operands).reduce(
      (count, op) => count + (snippet.match(new RegExp(`\\b${op}\\b`, "g")) || []).length,
      0,
    );

    const volume = (N1 + N2) * Math.log2(n1 + n2 || 1);
    const difficulty = (n1 / 2) * (N2 / n2);
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
