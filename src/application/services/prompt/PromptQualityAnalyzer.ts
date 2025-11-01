import type { EffectivenessScore } from "../../../domain/entities/PromptEngineering";

export class PromptQualityAnalyzer {
  measureClarity(prompt: string): number {
    const hasInstructions = /instruction|require|must|should/i.test(prompt);
    const hasStructure = /section|format|heading/i.test(prompt);
    const hasExamples = /example|sample/i.test(prompt);
    let score = 0;
    if (hasInstructions) score += 0.4;
    if (hasStructure) score += 0.3;
    if (hasExamples) score += 0.3;
    return score;
  }

  measureCompleteness(prompt: string): number {
    const hasContext = /context|project/i.test(prompt);
    const hasCode = /code|snippet/i.test(prompt);
    const hasOutput = /output|format|markdown/i.test(prompt);
    let score = 0;
    if (hasContext) score += 0.3;
    if (hasCode) score += 0.4;
    if (hasOutput) score += 0.3;
    return score;
  }

  measureSpecificity(prompt: string): number {
    const specificTerms = prompt.match(/\b(component|function|class|interface|method)\b/gi) || [];
    return Math.min(1.0, specificTerms.length / 5);
  }

  measureConsistency(prompt: string): number {
    const consistentStructure =
      /section|heading|format/i.test(prompt) && /markdown|code block/i.test(prompt);
    return consistentStructure ? 1.0 : 0.5;
  }

  calculateEffectivenessScore(prompt: string): EffectivenessScore {
    const clarity = this.measureClarity(prompt);
    const completeness = this.measureCompleteness(prompt);
    const specificity = this.measureSpecificity(prompt);
    const consistency = this.measureConsistency(prompt);

    const score = (clarity + completeness + specificity + consistency) / 4;

    return {
      score,
      metrics: {
        clarity,
        completeness,
        specificity,
        consistency,
      },
    };
  }
}
