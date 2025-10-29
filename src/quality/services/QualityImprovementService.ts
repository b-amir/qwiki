import {
  QualityMetrics,
  ImprovementSuggestion,
  ImprovementPlan,
  ProgressReport,
} from "../types/QualityTypes";
import { RecommendationType, Priority, Impact, Effort } from "../types/QualityTypes";

export class QualityImprovementService {
  async suggestImprovements(
    content: string,
    metrics: QualityMetrics,
  ): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    if (metrics.clarity < 0.7) {
      suggestions.push({
        type: RecommendationType.REPHRASE,
        description: "Simplify complex sentences for better readability",
        priority: Priority.MEDIUM,
        impact: Impact.MODERATE,
        effort: Effort.LOW,
        automatedAction: false,
      });
    }

    if (metrics.clarity < 0.5) {
      suggestions.push({
        type: RecommendationType.RESTRUCTURE,
        description: "Reorganize content with better headings and sections",
        priority: Priority.HIGH,
        impact: Impact.SIGNIFICANT,
        effort: Effort.MODERATE,
        automatedAction: false,
      });
    }

    if (metrics.completeness < 0.6) {
      suggestions.push({
        type: RecommendationType.ADD_CONTENT,
        description: "Add parameter descriptions and return value documentation",
        priority: Priority.HIGH,
        impact: Impact.SIGNIFICANT,
        effort: Effort.MODERATE,
        automatedAction: false,
      });
    }

    if (metrics.completeness < 0.4) {
      suggestions.push({
        type: RecommendationType.ADD_CONTENT,
        description: "Include code examples and usage scenarios",
        priority: Priority.HIGH,
        impact: Impact.CRITICAL,
        effort: Effort.HIGH,
        automatedAction: false,
      });
    }

    if (metrics.accuracy < 0.7) {
      suggestions.push({
        type: RecommendationType.VERIFY_FACTS,
        description: "Verify all code examples and technical details",
        priority: Priority.URGENT,
        impact: Impact.CRITICAL,
        effort: Effort.MODERATE,
        automatedAction: false,
      });
    }

    if (metrics.consistency < 0.6) {
      suggestions.push({
        type: RecommendationType.IMPROVE_STYLE,
        description: "Standardize terminology and formatting throughout",
        priority: Priority.LOW,
        impact: Impact.MODERATE,
        effort: Effort.MINIMAL,
        automatedAction: true,
      });
    }

    if (metrics.consistency < 0.4) {
      suggestions.push({
        type: RecommendationType.REPHRASE,
        description: "Fix inconsistent terminology and style",
        priority: Priority.MEDIUM,
        impact: Impact.MODERATE,
        effort: Effort.LOW,
        automatedAction: true,
      });
    }

    return suggestions;
  }

  async createImprovementPlan(content: string): Promise<ImprovementPlan> {
    const metrics = await this.calculateBasicMetrics(content);
    const suggestions = await this.suggestImprovements(content, metrics);

    const estimatedTime = this.calculateEstimatedTime(suggestions);
    const impact = this.calculateOverallImpact(suggestions);
    const priority = this.calculatePlanPriority(suggestions);
    const totalEffort = this.calculateTotalEffort(suggestions);
    const automatedActions = suggestions.filter((s) => s.automatedAction).length;

    return {
      suggestions,
      estimatedTime,
      impact,
      priority,
      totalEffort,
      automatedActions,
    };
  }

  async applyImprovement(content: string, suggestion: ImprovementSuggestion): Promise<string> {
    let improvedContent = content;

    switch (suggestion.type) {
      case RecommendationType.IMPROVE_STYLE:
        improvedContent = await this.applyStyleImprovements(content);
        break;
      case RecommendationType.REPHRASE:
        improvedContent = await this.applyRephrasing(content);
        break;
      case RecommendationType.ADD_CONTENT:
        improvedContent = await this.suggestContentAdditions(content);
        break;
      case RecommendationType.VERIFY_FACTS:
        improvedContent = await this.highlightFactsToVerify(content);
        break;
      default:
        improvedContent = content;
    }

    return improvedContent;
  }

  prioritizeSuggestions(suggestions: ImprovementSuggestion[]): ImprovementSuggestion[] {
    return suggestions.sort((a, b) => {
      const priorityOrder: Record<Priority, number> = {
        [Priority.URGENT]: 4,
        [Priority.HIGH]: 3,
        [Priority.MEDIUM]: 2,
        [Priority.LOW]: 1,
      };
      const impactOrder: Record<Impact, number> = {
        [Impact.CRITICAL]: 4,
        [Impact.SIGNIFICANT]: 3,
        [Impact.MODERATE]: 2,
        [Impact.MINIMAL]: 1,
      };
      const effortOrder: Record<Effort, number> = {
        [Effort.MINIMAL]: 4,
        [Effort.LOW]: 3,
        [Effort.MODERATE]: 2,
        [Effort.HIGH]: 1,
        [Effort.EXTENSIVE]: 0,
      };

      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      const aImpact = impactOrder[a.impact];
      const bImpact = impactOrder[b.impact];
      const aEffort = effortOrder[a.effort];
      const bEffort = effortOrder[b.effort];

      const aScore = aPriority * 0.4 + aImpact * 0.4 + aEffort * 0.2;
      const bScore = bPriority * 0.4 + bImpact * 0.4 + bEffort * 0.2;

      return bScore - aScore;
    });
  }

  async trackImprovementProgress(projectId: string): Promise<ProgressReport> {
    const allSuggestions = await this.getProjectSuggestions(projectId);
    const completedSuggestions = allSuggestions.filter((s: any) => s.completed);
    const pendingSuggestions = allSuggestions.filter((s: any) => !s.completed);
    const automatedSuggestions = allSuggestions.filter((s) => s.automatedAction);

    const averageImpact = this.calculateAverageImpact(allSuggestions);
    const completionRate =
      allSuggestions.length > 0 ? (completedSuggestions.length / allSuggestions.length) * 100 : 0;

    return {
      totalSuggestions: allSuggestions.length,
      completedSuggestions: completedSuggestions.length,
      pendingSuggestions: pendingSuggestions.length,
      automatedSuggestions: automatedSuggestions.length,
      averageImpact,
      completionRate,
    };
  }

  private async calculateBasicMetrics(content: string): Promise<QualityMetrics> {
    const clarity = this.assessClarity(content);
    const completeness = this.assessCompleteness(content);
    const accuracy = this.assessAccuracy(content);
    const consistency = this.assessConsistency(content);

    return {
      clarity,
      completeness,
      accuracy,
      consistency,
      overall: (clarity + completeness + accuracy + consistency) / 4,
    };
  }

  private assessClarity(content: string): number {
    let score = 0.5;
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    if (sentences.length === 0) return 0;

    const avgSentenceLength =
      sentences.reduce((sum, s) => sum + s.split(" ").length, 0) / sentences.length;

    if (avgSentenceLength >= 15 && avgSentenceLength <= 25) score += 0.3;
    else if (avgSentenceLength < 15) score += 0.1;

    if (content.includes("\n\n")) score += 0.2;

    return Math.min(score, 1.0);
  }

  private assessCompleteness(content: string): number {
    let score = 0.3;

    if (/```|`[^`]+`/.test(content)) score += 0.2;
    if (/parameter|arg|option/i.test(content)) score += 0.2;
    if (/return|returns|output/i.test(content)) score += 0.2;
    if (/error|exception|throw/i.test(content)) score += 0.1;

    return Math.min(score, 1.0);
  }

  private assessAccuracy(content: string): number {
    return 0.8;
  }

  private assessConsistency(content: string): number {
    let score = 0.6;

    const terms = content.toLowerCase().split(/\s+/);
    const uniqueTerms = new Set(terms);
    const consistencyRatio = uniqueTerms.size / terms.length;

    if (consistencyRatio > 0.3 && consistencyRatio < 0.7) score += 0.2;

    return Math.min(score, 1.0);
  }

  private calculateEstimatedTime(suggestions: ImprovementSuggestion[]): number {
    const effortMinutes: Record<Effort, number> = {
      [Effort.MINIMAL]: 5,
      [Effort.LOW]: 15,
      [Effort.MODERATE]: 30,
      [Effort.HIGH]: 60,
      [Effort.EXTENSIVE]: 120,
    };

    return suggestions.reduce((total, suggestion) => {
      return total + effortMinutes[suggestion.effort];
    }, 0);
  }

  private calculateOverallImpact(suggestions: ImprovementSuggestion[]): Impact {
    if (suggestions.some((s) => s.impact === Impact.CRITICAL)) return Impact.CRITICAL;
    if (suggestions.some((s) => s.impact === Impact.SIGNIFICANT)) return Impact.SIGNIFICANT;
    if (suggestions.some((s) => s.impact === Impact.MODERATE)) return Impact.MODERATE;
    return Impact.MINIMAL;
  }

  private calculatePlanPriority(suggestions: ImprovementSuggestion[]): Priority {
    if (suggestions.some((s) => s.priority === Priority.URGENT)) return Priority.URGENT;
    if (suggestions.some((s) => s.priority === Priority.HIGH)) return Priority.HIGH;
    if (suggestions.some((s) => s.priority === Priority.MEDIUM)) return Priority.MEDIUM;
    return Priority.LOW;
  }

  private calculateTotalEffort(suggestions: ImprovementSuggestion[]): Effort {
    const effortValues: Record<Effort, number> = {
      [Effort.MINIMAL]: 1,
      [Effort.LOW]: 2,
      [Effort.MODERATE]: 3,
      [Effort.HIGH]: 4,
      [Effort.EXTENSIVE]: 5,
    };

    const totalEffortValue = suggestions.reduce((total, suggestion) => {
      return total + effortValues[suggestion.effort];
    }, 0);

    const averageEffort = totalEffortValue / suggestions.length;

    if (averageEffort >= 4.5) return Effort.EXTENSIVE;
    if (averageEffort >= 3.5) return Effort.HIGH;
    if (averageEffort >= 2.5) return Effort.MODERATE;
    if (averageEffort >= 1.5) return Effort.LOW;
    return Effort.MINIMAL;
  }

  private async applyStyleImprovements(content: string): Promise<string> {
    let improved = content;

    improved = improved.replace(/\b(function|method)\b/gi, "**$1**");
    improved = improved.replace(/\b(parameter|argument)\b/gi, "**$1**");
    improved = improved.replace(/\b(return|returns?)\b/gi, "**$1**");

    return improved;
  }

  private async applyRephrasing(content: string): Promise<string> {
    let improved = content;

    improved = improved.replace(/\bvery\b\s+(\w+)/gi, "$1");
    improved = improved.replace(/\breally\b\s+(\w+)/gi, "$1");
    improved = improved.replace(/\bquite\b\s+(\w+)/gi, "$1");

    return improved;
  }

  private async suggestContentAdditions(content: string): Promise<string> {
    const additions: string[] = [];

    if (!/example/i.test(content)) {
      additions.push("\n\n**Example:**\n```javascript\n// Add example code here\n```");
    }

    if (!/parameter|arg/i.test(content)) {
      additions.push("\n\n**Parameters:**\n- `param1` (type): Description of parameter\n");
    }

    return content + additions.join("");
  }

  private async highlightFactsToVerify(content: string): Promise<string> {
    let highlighted = content;

    highlighted = highlighted.replace(/(\d+\.\d+(\.\d+)?)/g, "**$1** *[Verify version]*");
    highlighted = highlighted.replace(/(`[^`]+`)/g, "$1 *[Verify code]*");

    return highlighted;
  }

  private async getProjectSuggestions(projectId: string): Promise<any[]> {
    return [];
  }

  private calculateAverageImpact(suggestions: ImprovementSuggestion[]): number {
    if (suggestions.length === 0) return 0;

    const impactValues: Record<Impact, number> = {
      [Impact.CRITICAL]: 4,
      [Impact.SIGNIFICANT]: 3,
      [Impact.MODERATE]: 2,
      [Impact.MINIMAL]: 1,
    };

    const totalImpact = suggestions.reduce((sum, s) => sum + impactValues[s.impact], 0);
    return totalImpact / suggestions.length;
  }
}
