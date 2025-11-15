import type { StructureValidation } from "@/domain/entities/PromptEngineering";

export class PromptStructureValidator {
  async validatePromptStructure(prompt: string): Promise<StructureValidation> {
    const hasInstructions = /instruction|require|must|should|output/i.test(prompt);
    const hasContext = /context|project|file/i.test(prompt);
    const hasCodeSection = /```|code|snippet/i.test(prompt);
    const hasOutputFormat = /markdown|format|output|section/i.test(prompt);

    const issues: string[] = [];
    if (!hasInstructions) issues.push("Missing clear instructions");
    if (!hasContext) issues.push("No context information provided");
    if (!hasCodeSection) issues.push("No code section identified");
    if (!hasOutputFormat) issues.push("No output format specification");

    return {
      isValid: issues.length === 0,
      hasInstructions,
      hasContext,
      hasCodeSection,
      hasOutputFormat,
      issues,
    };
  }
}
