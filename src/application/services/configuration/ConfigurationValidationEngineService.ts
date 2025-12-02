import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ConfigurationSchema,
  SchemaField,
  SchemaDependency,
} from "@/domain/configuration";

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  field?: string;
  condition: (value: unknown, context: ValidationContext) => boolean;
  validator: (value: unknown, context: ValidationContext) => ValidationResult;
  enabled: boolean;
}

export interface ValidationContext {
  configuration: unknown;
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

export class ConfigurationValidationEngineService {
  private rules = new Map<string, ValidationRule>();
  private statistics: ValidationStatistics = {
    totalRules: 0,
    enabledRules: 0,
    executedRules: 0,
    failedRules: 0,
    averageExecutionTime: 0,
  };

  validateConfiguration(
    config: unknown,
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
        const fieldValue = rule.field ? this.getFieldValue(config, rule.field) : config;
        const result = rule.validator(fieldValue, context);

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

  addProviderValidationRules(providerId: string, rules: ValidationRule[]): void {
    for (const rule of rules) {
      const ruleId = `${providerId}-${rule.id}`;
      this.rules.set(ruleId, { ...rule, id: ruleId });
      this.statistics.totalRules++;
      if (rule.enabled) {
        this.statistics.enabledRules++;
      }
    }
  }

  getProviderRules(providerId: string): ValidationRule[] {
    const prefix = `${providerId}-`;
    const providerRules: ValidationRule[] = [];
    for (const [ruleId, rule] of this.rules) {
      if (ruleId.startsWith(prefix)) {
        providerRules.push(rule);
      }
    }
    return providerRules.sort((a, b) => a.priority - b.priority);
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
    let enabledRulesCount = 0;
    for (const rule of this.rules.values()) {
      if (rule.enabled) enabledRulesCount++;
    }
    this.statistics = {
      totalRules: this.rules.size,
      enabledRules: enabledRulesCount,
      executedRules: 0,
      failedRules: 0,
      averageExecutionTime: 0,
    };
  }

  validateProviderConfig(
    providerId: string,
    config: unknown,
    availableModels?: string[],
  ): ValidationResult {
    const context: ValidationContext = {
      configuration: config,
      providerId,
      operation: "update",
      timestamp: new Date(),
    };

    const emptySchema: ConfigurationSchema = {
      version: "1.0.0",
      fields: [],
      dependencies: [],
    };

    const providerRules = this.getProviderRules(providerId);
    const providerRuleIds = new Set(providerRules.map((r) => r.id));
    const providerPrefix = `${providerId}-`;
    const commonRules = Array.from(this.rules.values()).filter(
      (rule) =>
        !rule.id.startsWith(providerPrefix) &&
        !providerRuleIds.has(rule.id) &&
        !rule.id.includes("-"),
    );

    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let executedCount = 0;

    context.configuration = config;
    context.schema = emptySchema;

    const allRules = [...providerRules, ...commonRules];
    for (const rule of allRules) {
      if (!rule.enabled) continue;

      if (rule.field && !this.hasField(config, rule.field)) {
        continue;
      }

      if (rule.condition(config, context)) {
        executedCount++;
        const fieldValue = rule.field ? this.getFieldValue(config, rule.field) : config;
        const result = rule.validator(fieldValue, context);

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

    const baseResult: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    const configObj = config as Record<string, unknown>;
    if (configObj.model && availableModels && availableModels.length > 0) {
      const modelErrors: ValidationError[] = [];
      const modelWarnings: ValidationWarning[] = [];

      if (typeof configObj.model !== "string") {
        modelErrors.push({
          field: "model",
          code: "MODEL_INVALID_TYPE",
          message: "Model must be a string",
          severity: "error",
        });
      } else if (!availableModels.includes(configObj.model)) {
        modelWarnings.push({
          field: "model",
          code: "MODEL_NOT_IN_LIST",
          message: `Model "${configObj.model}" is not in the provider's available models. Available models: ${availableModels.slice(0, 5).join(", ")}${availableModels.length > 5 ? "..." : ""}`,
        });
      }

      return {
        isValid: baseResult.isValid && modelErrors.length === 0,
        errors: [...baseResult.errors, ...modelErrors],
        warnings: [...baseResult.warnings, ...modelWarnings],
      };
    }

    return baseResult;
  }

  validateGlobalConfig(config: unknown): ValidationResult {
    const context: ValidationContext = {
      configuration: config,
      operation: "update",
      timestamp: new Date(),
    };

    const emptySchema: ConfigurationSchema = {
      version: "1.0.0",
      fields: [],
      dependencies: [],
    };

    return this.validateConfiguration(config, emptySchema, context);
  }

  private hasField(config: unknown, fieldPath: string): boolean {
    const parts = fieldPath.split(".");
    let current = config as Record<string, unknown>;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return false;
      }
      current = current[part] as Record<string, unknown>;
    }

    return current !== undefined;
  }

  private getFieldValue(config: unknown, fieldPath: string): unknown {
    if (typeof config !== "object" || config === null) {
      return undefined;
    }

    const parts = fieldPath.split(".");
    let current: unknown = config;

    for (const part of parts) {
      if (typeof current !== "object" || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private updateAverageExecutionTime(executionTime: number): void {
    const totalExecutions = this.statistics.executedRules;
    const currentAverage = this.statistics.averageExecutionTime;

    this.statistics.averageExecutionTime =
      (currentAverage * (totalExecutions - 1) + executionTime) / totalExecutions;
  }
}
