import { PromptQualityAnalyzer } from "@/application/services/prompts/PromptQualityAnalyzer";
import type { ClarityScore } from "@/domain/entities/PromptEngineering";

export class PromptClarityAnalyzer {
  constructor(private qualityAnalyzer: PromptQualityAnalyzer) {}

  async testPromptClarity(prompt: string): Promise<ClarityScore> {
    const hasClearInstructions = /instruction|require|must|should/i.test(prompt);
    const hasStructure = /section|format|heading|structure/i.test(prompt);
    const hasExamples = /example|sample|demonstration/i.test(prompt);

    const issues: string[] = [];
    if (!hasClearInstructions) issues.push("Instructions are not clearly stated");
    if (!hasStructure) issues.push("Prompt lacks clear structure");
    if (!hasExamples) issues.push("No examples provided");

    const score = this.qualityAnalyzer.measureClarity(prompt);

    return {
      score,
      hasClearInstructions,
      hasStructure,
      hasExamples,
      issues,
    };
  }
}
