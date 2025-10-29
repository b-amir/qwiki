import { PromptVariable } from "../types/PromptTypes";

export interface ValidationRule {
  name: string;
  description: string;
  validator: (content: string) => string[];
}

export interface QualityScore {
  overall: number;
  clarity: number;
  specificity: number;
  completeness: number;
  consistency: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ImprovementSuggestion {
  type: string;
  description: string;
  priority: number;
  action: string;
}

export interface ComparisonResult {
  betterPromptId: string | null;
  rationale: string;
  scores: { left: QualityScore; right: QualityScore };
}

export class PromptValidationService {
  private rules: ValidationRule[] = [
    {
      name: "min_length",
      description: "Prompt should have at least 40 characters",
      validator: (content) => (content.trim().length < 40 ? ["too_short"] : []),
    },
    {
      name: "has_instructions",
      description: "Prompt should include imperative instruction words",
      validator: (content) =>
        /\b(explain|document|summarize|analyze)\b/i.test(content) ? [] : ["missing_instruction"],
    },
    {
      name: "structure_markers",
      description: "Prompt should include structure markers like sections or bullets",
      validator: (content) =>
        /\n-\s|\n\d+\.|###|\*\*/.test(content) ? [] : ["missing_structure_markers"],
    },
  ];

  async validatePrompt(content: string): Promise<ValidationResult> {
    const errors: string[] = [];
    for (const rule of this.rules) {
      errors.push(...rule.validator(content));
    }
    const warnings: string[] = [];
    const suggestions: string[] = this.buildSuggestions(content, errors);
    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  async scorePromptQuality(content: string): Promise<QualityScore> {
    const length = content.trim().length;
    const clarity = this.scoreClarity(content);
    const specificity = this.scoreSpecificity(content);
    const completeness = this.scoreCompleteness(content);
    const consistency = this.scoreConsistency(content);
    const lengthBoost = Math.max(0, Math.min(15, Math.floor((length - 80) / 40)));
    const overallBase = Math.round((clarity + specificity + completeness + consistency) / 4);
    const overall = Math.max(0, Math.min(100, overallBase + lengthBoost));
    return { overall, clarity, specificity, completeness, consistency };
  }

  async suggestImprovements(content: string): Promise<ImprovementSuggestion[]> {
    const validation = await this.validatePrompt(content);
    const suggestions: ImprovementSuggestion[] = [];
    for (const e of validation.errors) suggestions.push(this.errorToSuggestion(e));
    if (!/\bconstraints?:/i.test(content))
      suggestions.push({
        type: "constraints",
        description: "Add explicit constraints and boundaries",
        priority: 2,
        action: "Add a Constraints section with bullet points",
      });
    if (!/\bformat\b|\bmarkdown\b/i.test(content))
      suggestions.push({
        type: "format",
        description: "Specify expected output format",
        priority: 2,
        action: "State output format and include a minimal example",
      });
    return suggestions;
  }
  errorToSuggestion(e: string): ImprovementSuggestion {
    throw new Error("Method not implemented.");
  }

  async comparePrompts(leftId: string, rightId: string): Promise<ComparisonResult> {
    const left = await this.scorePromptQuality(leftId);
    const right = await this.scorePromptQuality(rightId);
    const leftScore = left.overall;
    const rightScore = right.overall;
    const betterPromptId =
      leftScore === rightScore ? null : leftScore > rightScore ? leftId : rightId;
    const rationale = betterPromptId ? "Higher overall quality score" : "Scores are equal";
    return { betterPromptId, rationale, scores: { left, right } };
  }

  validatePromptVariables(content: string, variables: PromptVariable[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const placeholders = new Set<string>(
      (content.match(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g) || []).map((m) =>
        m.replace(/^{\{\s*|\s*\}\}$/g, "").trim(),
      ),
    );
    const varNames = new Set(variables.map((v) => v.name));
    for (const v of variables) {
      if (!placeholders.has(v.name)) warnings.push(`unused_variable:${v.name}`);
    }
    for (const p of placeholders) {
      if (!varNames.has(p)) errors.push(`unknown_placeholder:${p}`);
    }
    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  addValidationRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  removeValidationRule(ruleName: string): void {
    this.rules = this.rules.filter((r) => r.name !== ruleName);
  }

  private scoreClarity(content: string): number {
    const hasImperatives = /\b(explain|document|summarize|analyze|show|list|describe)\b/i.test(
      content,
    );
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
    const value = (hasImperatives ? 60 : 35) + Math.min(40, sentences * 3);
    return Math.max(0, Math.min(100, value));
  }

  private scoreSpecificity(content: string): number {
    const hasLists = /\n-\s|\n\d+\.|\*/.test(content);
    const hasConstraints = /constraints?:/i.test(content);
    const hasExamples = /example:|e\.g\.|for example/i.test(content);
    const value = (hasLists ? 35 : 10) + (hasConstraints ? 35 : 10) + (hasExamples ? 30 : 10);
    return Math.max(0, Math.min(100, value));
  }

  private scoreCompleteness(content: string): number {
    const hasContext = /context:/i.test(content);
    const hasSteps = /steps?:/i.test(content);
    const hasOutput = /output:|result:|deliverables?:/i.test(content);
    const value = (hasContext ? 35 : 15) + (hasSteps ? 35 : 15) + (hasOutput ? 30 : 10);
    return Math.max(0, Math.min(100, value));
  }

  private scoreConsistency(content: string): number {
    const headings = (content.match(/^#+\s/gm) || []).length;
    const bullets = (content.match(/\n-\s/g) || []).length;
    const codeFences = (content.match(/```/g) || []).length / 2;
    const structural = headings + bullets + codeFences;
    const value = Math.min(100, 20 + structural * 15);
    return Math.max(0, value);
  }

  private buildSuggestions(content: string, errors: string[]): string[] {
    const s: string[] = [];
    if (errors.includes("too_short"))
      s.push("Expand instructions to include goals, constraints, and format");
    if (errors.includes("missing_instruction"))
      s.push("Use imperative verbs like 'document', 'explain', or 'summarize'");
    if (errors.includes("missing_structure_markers"))
      s.push("Add bullets, numbered steps, or headings for structure");
    if (!/\bformat\b|\bmarkdown\b/i.test(content))
      s.push("Specify the expected output format (e.g., Markdown)");
    return s;
  }
}
