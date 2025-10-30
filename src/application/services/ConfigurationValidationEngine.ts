import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ConfigurationSchema,
  SchemaField,
  SchemaDependency,
} from "../../domain/configuration";

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  field?: string;
  condition: (value: any, context: ValidationContext) => boolean;
  validator: (value: any, context: ValidationContext) => ValidationResult;
  enabled: boolean;
}

export interface ValidationContext {
  configuration: any;
  schema?: ConfigurationSchema;
  providerId?: string;
  operation: "create" | "update" | "delete";
  userId?: string;
  timestamp: Date;
}

export interface ValidationStatistics {
  totalRules: number;
  enabledRules: number;
  executedRules: number;
  failedRules: number;
  averageExecutionTime: number;
}

export class ConfigurationValidationEngine {
  private rules = new Map<string, ValidationRule>();
  private statistics: ValidationStatistics = {
    totalRules: 0,
    enabledRules: 0,
    executedRules: 0,
    failedRules: 0,
    averageExecutionTime: 0,
  };

  validateConfiguration(
    config: any,
    schema: ConfigurationSchema,
    context: ValidationContext,
  ): ValidationResult {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let executedCount = 0;

    context.configuration = config;
    context.schema = schema;

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      if (rule.field && !this.hasField(config, rule.field)) {
        continue;
      }

      if (rule.condition(config, context)) {
        executedCount++;
        const result = rule.validator(config, context);

        errors.push(...result.errors);
        warnings.push(...result.warnings);

        if (!result.isValid) {
          this.statistics.failedRules++;
        }
      }
    }

    this.statistics.executedRules += executedCount;
    const executionTime = Date.now() - startTime;
    this.updateAverageExecutionTime(executionTime);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  addValidationRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
    this.statistics.totalRules++;
    if (rule.enabled) {
      this.statistics.enabledRules++;
    }
  }

  removeValidationRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.statistics.totalRules--;
      if (rule.enabled) {
        this.statistics.enabledRules--;
      }
    }
  }

  getValidationRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): ValidationRule | undefined {
    return this.rules.get(ruleId);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule && !rule.enabled) {
      rule.enabled = true;
      this.statistics.enabledRules++;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule && rule.enabled) {
      rule.enabled = false;
      this.statistics.enabledRules--;
    }
  }

  getStatistics(): ValidationStatistics {
    return { ...this.statistics };
  }

  resetStatistics(): void {
    this.statistics = {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter((rule) => rule.enabled).length,
      executedRules: 0,
      failedRules: 0,
      averageExecutionTime: 0,
    };
  }

  private hasField(config: any, fieldPath: string): boolean {
    const parts = fieldPath.split(".");
    let current = config;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return false;
      }
      current = current[part];
    }

    return current !== undefined;
  }

  private updateAverageExecutionTime(executionTime: number): void {
    const totalExecutions = this.statistics.executedRules;
    const currentAverage = this.statistics.averageExecutionTime;

    this.statistics.averageExecutionTime =
      (currentAverage * (totalExecutions - 1) + executionTime) / totalExecutions;
  }
}
