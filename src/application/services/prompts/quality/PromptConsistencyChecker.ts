import { PromptQualityAnalyzer } from "@/application/services/prompts/PromptQualityAnalyzer";
import type { ConsistencyScore } from "@/domain/entities/PromptEngineering";

export class PromptConsistencyChecker {
  constructor(private qualityAnalyzer: PromptQualityAnalyzer) {}

  async checkPromptConsistency(prompt: string): Promise<ConsistencyScore> {
    const formatConsistency =
      /section|format|heading/i.test(prompt) && /markdown|code block|output/i.test(prompt);
    const terminologyConsistency = this.checkTerminologyConsistency(prompt);

    const issues: string[] = [];
    if (!formatConsistency) issues.push("Inconsistent formatting instructions");
    if (!terminologyConsistency) issues.push("Inconsistent terminology usage");

    const score = this.qualityAnalyzer.measureConsistency(prompt);

    return {
      score,
      formatConsistency,
      terminologyConsistency,
      issues,
    };
  }

  private checkTerminologyConsistency(prompt: string): boolean {
    const formatTerms = prompt.match(/(markdown|md|format|output)/gi) || [];
    const codeTerms = prompt.match(/(code|snippet|source|implementation)/gi) || [];

    return formatTerms.length > 0 && codeTerms.length > 0;
  }
}
