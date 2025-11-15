import { PromptQualityAnalyzer } from "@/application/services/prompts/PromptQualityAnalyzer";
import type { SpecificityScore } from "@/domain/entities/PromptEngineering";

export class PromptSpecificityAnalyzer {
  constructor(private qualityAnalyzer: PromptQualityAnalyzer) {}

  async measurePromptSpecificity(prompt: string): Promise<SpecificityScore> {
    const specificTerms =
      prompt.match(
        /\b(component|function|class|interface|method|property|parameter|return|type|implementation)\b/gi,
      ) || [];
    const vagueTerms = prompt.match(/\b(thing|stuff|something|anything|somehow)\b/gi) || [];

    const issues: string[] = [];
    if (vagueTerms.length > 0) {
      issues.push(`Found ${vagueTerms.length} vague term(s): ${vagueTerms.slice(0, 3).join(", ")}`);
    }
    if (specificTerms.length < 3) {
      issues.push("Prompt lacks sufficient specific technical terms");
    }

    const score = this.qualityAnalyzer.measureSpecificity(prompt);

    return {
      score,
      specificTerms: specificTerms.slice(0, 10),
      vagueTerms,
      issues,
    };
  }
}
