import { PerformanceBudgets } from "@/constants/ServiceLimits";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

export interface PerformancePercentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface BudgetCheckResult {
  operation: string;
  duration: number;
  budgetExceeded: boolean;
  percentile?: PerformancePercentiles;
  budget?: {
    p50: number;
    p95: number;
    p99: number;
    alertThreshold: number;
  };
}

export class PerformanceBudgetService {
  private operationDurations: Map<string, number[]> = new Map();
  private readonly MAX_SAMPLES = 1000;
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("PerformanceBudgetService");
  }

  recordOperation(operation: string, duration: number): BudgetCheckResult {
    if (!this.operationDurations.has(operation)) {
      this.operationDurations.set(operation, []);
    }

    const durations = this.operationDurations.get(operation)!;
    durations.push(duration);

    if (durations.length > this.MAX_SAMPLES) {
      durations.shift();
    }

    const percentiles = this.getPercentiles(operation);
    const budget = this.getBudget(operation);
    const budgetExceeded = budget ? duration > budget.alertThreshold : false;

    if (budgetExceeded) {
      this.logger.warn("Performance budget exceeded", {
        operation,
        duration,
        threshold: budget?.alertThreshold,
        p50: percentiles?.p50,
        p95: percentiles?.p95,
        p99: percentiles?.p99,
      });
    }

    return {
      operation,
      duration,
      budgetExceeded,
      percentile: percentiles || undefined,
      budget: budget || undefined,
    };
  }

  getPercentiles(operation: string): PerformancePercentiles | null {
    const durations = this.operationDurations.get(operation);
    if (!durations || durations.length === 0) {
      return null;
    }

    const sorted = [...durations].sort((a, b) => a - b);

    return {
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  private getBudget(operation: string): {
    p50: number;
    p95: number;
    p99: number;
    alertThreshold: number;
  } | null {
    const budgetKey = this.getBudgetKey(operation);
    if (!budgetKey) {
      return null;
    }

    const budget = PerformanceBudgets[budgetKey as keyof typeof PerformanceBudgets];
    if (!budget) {
      return null;
    }

    return budget;
  }

  private getBudgetKey(operation: string): string | null {
    const normalized = operation.toLowerCase();

    if (normalized.includes("generate") && normalized.includes("wiki")) {
      return "generateWiki";
    }

    if (normalized.includes("file") && normalized.includes("relevance")) {
      return "fileRelevanceAnalysis";
    }

    if (normalized.includes("language") && normalized.includes("server")) {
      return "languageServerQuery";
    }

    if (normalized.includes("project") && normalized.includes("context")) {
      return "projectContextBuild";
    }

    if (normalized.includes("wiki") && normalized.includes("generation")) {
      return "wikiGeneration";
    }

    if (normalized.includes("provider") && normalized.includes("selection")) {
      return "providerSelection";
    }

    if (normalized.includes("context") && normalized.includes("analysis")) {
      return "contextAnalysis";
    }

    return null;
  }

  checkBudget(operation: string, duration: number): boolean {
    const budget = this.getBudget(operation);
    if (!budget) {
      return false;
    }

    return duration > budget.alertThreshold;
  }

  getAllPercentiles(): Record<string, PerformancePercentiles> {
    const result: Record<string, PerformancePercentiles> = {};

    for (const operation of this.operationDurations.keys()) {
      const percentiles = this.getPercentiles(operation);
      if (percentiles) {
        result[operation] = percentiles;
      }
    }

    return result;
  }

  clearMetrics(operation?: string): void {
    if (operation) {
      this.operationDurations.delete(operation);
    } else {
      this.operationDurations.clear();
    }
  }
}
