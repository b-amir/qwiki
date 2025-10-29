import { PromptContext, PromptTemplate } from "../types/PromptTypes";

export interface AdjustmentRule {
  id: string;
  condition: (context: PromptContext, template: PromptTemplate) => boolean;
  transformation: (content: string, context: PromptContext, template: PromptTemplate) => string;
  priority: number;
}

export interface ContextAnalysis {
  complexity: "simple" | "moderate" | "complex";
  domain?: string;
  language?: string;
  style?: string;
}

export class DynamicPromptAdjustmentService {
  private rules: AdjustmentRule[] = [];

  async analyzeContext(context: PromptContext): Promise<ContextAnalysis> {
    const code = String((context as any)?.codeContext?.snippet || "");
    const language = String(
      (context as any)?.codeContext?.language || (context as any)?.projectContext?.language || "",
    );
    const len = code.length;
    const complexity = len < 200 ? "simple" : len < 1000 ? "moderate" : "complex";
    const domain = /react|vue|angular|svelte/i.test(code)
      ? "frontend"
      : /express|fastapi|django|flask|koa/i.test(code)
        ? "backend"
        : undefined;
    const style = (context as any)?.userPreferences?.style || undefined;
    return { complexity, domain, language: language || undefined, style };
  }

  async adjustPrompt(template: PromptTemplate, context: PromptContext): Promise<string> {
    const applicable = this.rules
      .filter((r) => r.condition(context, template))
      .sort((a, b) => b.priority - a.priority);
    let content = template.content;
    for (const rule of applicable) content = rule.transformation(content, context, template);
    return content;
  }

  addAdjustmentRule(rule: AdjustmentRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeAdjustmentRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  async getAppliedAdjustments(
    template: PromptTemplate,
    context: PromptContext,
  ): Promise<AdjustmentRule[]> {
    return this.rules
      .filter((r) => r.condition(context, template))
      .sort((a, b) => b.priority - a.priority);
  }
}
