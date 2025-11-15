import type { ComplexityAnalysis } from "@/domain/entities/PromptEngineering";

export class ComplexityAnalyzer {
  analyzeCodeComplexity(content: string): ComplexityAnalysis {
    const lines = content.split("\n");
    const functionMatches = content.match(/(?:function|const|let|var|async)\s+\w+\s*[=(]/g) || [];
    const classMatches = content.match(/class\s+\w+/g) || [];
    const interfaceMatches = content.match(/interface\s+\w+/g) || [];
    const nestingDepth = this.calculateSimpleNesting(content);

    const functions = functionMatches.length;
    const classes = classMatches.length;
    const interfaces = interfaceMatches.length;

    const overall = Math.min(
      1.0,
      functions * 0.1 + classes * 0.2 + interfaces * 0.15 + nestingDepth * 0.1,
    );

    return {
      overall,
      cyclomatic: functions + nestingDepth,
      cognitive: nestingDepth * 0.5,
      functions,
      classes,
      interfaces,
      lines: lines.length,
    };
  }

  private calculateSimpleNesting(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of content) {
      if (char === "{") {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === "}") {
        currentDepth--;
      }
    }

    return maxDepth;
  }
}
