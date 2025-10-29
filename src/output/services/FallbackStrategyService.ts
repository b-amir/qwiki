import { ValidationResult } from "./OutputValidationService";

export interface FallbackRule {
  id: string;
  condition: (content: string, validation: ValidationResult) => boolean;
  action: "regenerate" | "provider_switch" | "template_fallback" | "normalize_then_revalidate";
  priority: number;
  transform?: (content: string) => Promise<string> | string;
}

export interface FallbackResult {
  success: boolean;
  content: string;
  appliedRule?: FallbackRule;
  metadata?: Record<string, unknown>;
}

export class FallbackStrategyService {
  private rules: FallbackRule[] = [];

  async evaluateFallback(content: string, validation: ValidationResult): Promise<boolean> {
    if (validation.valid) return false;
    return this.rules.some((r) => r.condition(content, validation));
  }

  async applyFallback(content: string, validation: ValidationResult): Promise<FallbackResult> {
    if (validation.valid) return { success: true, content };
    const chain = await this.getFallbackChain(content, validation);
    let current = content;
    for (const rule of chain) {
      if (rule.transform) current = await rule.transform(current);
      if (rule.action === "normalize_then_revalidate") {
        continue;
      }
      return {
        success: true,
        content: current,
        appliedRule: rule,
        metadata: { action: rule.action },
      };
    }
    return { success: false, content, metadata: { reason: "no_applicable_rule" } };
  }

  addFallbackRule(rule: FallbackRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeFallbackRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  async getFallbackChain(content: string, validation: ValidationResult): Promise<FallbackRule[]> {
    return this.rules
      .filter((r) => r.condition(content, validation))
      .sort((a, b) => b.priority - a.priority);
  }
}
