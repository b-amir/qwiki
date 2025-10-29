import type {
  ProviderConfiguration,
  GlobalConfiguration,
  ValidationResult,
  ConfigurationSchema,
  ValidationError,
  ValidationWarning,
} from "../../domain/configuration";

export class ConfigurationValidator {
  private providerSchemas = new Map<string, ConfigurationSchema>();
  private globalSchema!: ConfigurationSchema;

  constructor() {
    this.initializeSchemas();
  }

  validateProviderConfig(providerId: string, config: any): ValidationResult {
    const schema = this.getSchemaForProvider(providerId);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!schema) {
      errors.push({
        field: "provider",
        code: "UNKNOWN_PROVIDER",
        message: `Unknown provider: ${providerId}`,
        severity: "error",
      });
      return { isValid: false, errors, warnings };
    }

    this.validateAgainstSchema(config, schema, errors, warnings);

    if (config.apiKey && typeof config.apiKey === "string") {
      if (config.apiKey.length < 10) {
        errors.push({
          field: "apiKey",
          code: "API_KEY_TOO_SHORT",
          message: "API key appears to be too short",
          severity: "error",
        });
      }

      if (config.apiKey.includes(" ") || config.apiKey.includes("\n")) {
        errors.push({
          field: "apiKey",
          code: "API_KEY_INVALID_CHARS",
          message: "API key contains invalid characters",
          severity: "error",
        });
      }
    }

    if (config.temperature !== undefined) {
      if (
        typeof config.temperature !== "number" ||
        config.temperature < 0 ||
        config.temperature > 2
      ) {
        errors.push({
          field: "temperature",
          code: "TEMPERATURE_OUT_OF_RANGE",
          message: "Temperature must be between 0 and 2",
          severity: "error",
        });
      }
    }

    if (config.maxTokens !== undefined) {
      if (
        typeof config.maxTokens !== "number" ||
        config.maxTokens < 1 ||
        config.maxTokens > 32000
      ) {
        errors.push({
          field: "maxTokens",
          code: "MAX_TOKENS_OUT_OF_RANGE",
          message: "Max tokens must be between 1 and 32000",
          severity: "error",
        });
      }
    }

    if (config.topP !== undefined) {
      if (typeof config.topP !== "number" || config.topP < 0 || config.topP > 1) {
        errors.push({
          field: "topP",
          code: "TOP_P_OUT_OF_RANGE",
          message: "Top P must be between 0 and 1",
          severity: "error",
        });
      }
    }

    if (config.frequencyPenalty !== undefined) {
      if (
        typeof config.frequencyPenalty !== "number" ||
        config.frequencyPenalty < -2 ||
        config.frequencyPenalty > 2
      ) {
        errors.push({
          field: "frequencyPenalty",
          code: "FREQUENCY_PENALTY_OUT_OF_RANGE",
          message: "Frequency penalty must be between -2 and 2",
          severity: "error",
        });
      }
    }

    if (config.presencePenalty !== undefined) {
      if (
        typeof config.presencePenalty !== "number" ||
        config.presencePenalty < -2 ||
        config.presencePenalty > 2
      ) {
        errors.push({
          field: "presencePenalty",
          code: "PRESENCE_PENALTY_OUT_OF_RANGE",
          message: "Presence penalty must be between -2 and 2",
          severity: "error",
        });
      }
    }

    if (config.rateLimitPerMinute !== undefined) {
      if (typeof config.rateLimitPerMinute !== "number" || config.rateLimitPerMinute < 1) {
        errors.push({
          field: "rateLimitPerMinute",
          code: "RATE_LIMIT_INVALID",
          message: "Rate limit per minute must be a positive number",
          severity: "error",
        });
      }
    }

    if (config.timeout !== undefined) {
      if (typeof config.timeout !== "number" || config.timeout < 1000 || config.timeout > 300000) {
        errors.push({
          field: "timeout",
          code: "TIMEOUT_OUT_OF_RANGE",
          message: "Timeout must be between 1000ms and 300000ms",
          severity: "error",
        });
      }
    }

    if (config.retryAttempts !== undefined) {
      if (
        typeof config.retryAttempts !== "number" ||
        config.retryAttempts < 0 ||
        config.retryAttempts > 10
      ) {
        errors.push({
          field: "retryAttempts",
          code: "RETRY_ATTEMPTS_OUT_OF_RANGE",
          message: "Retry attempts must be between 0 and 10",
          severity: "error",
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateGlobalConfig(config: any): ValidationResult {
    const schema = this.getSchemaForGlobal();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateAgainstSchema(config, schema, errors, warnings);

    if (config.maxContextLength !== undefined) {
      if (
        typeof config.maxContextLength !== "number" ||
        config.maxContextLength < 1000 ||
        config.maxContextLength > 100000
      ) {
        errors.push({
          field: "maxContextLength",
          code: "MAX_CONTEXT_LENGTH_OUT_OF_RANGE",
          message: "Max context length must be between 1000 and 100000",
          severity: "error",
        });
      }
    }

    if (config.cacheExpirationHours !== undefined) {
      if (
        typeof config.cacheExpirationHours !== "number" ||
        config.cacheExpirationHours < 1 ||
        config.cacheExpirationHours > 168
      ) {
        errors.push({
          field: "cacheExpirationHours",
          code: "CACHE_EXPIRATION_OUT_OF_RANGE",
          message: "Cache expiration must be between 1 and 168 hours",
          severity: "error",
        });
      }
    }

    if (config.backupRetentionDays !== undefined) {
      if (
        typeof config.backupRetentionDays !== "number" ||
        config.backupRetentionDays < 1 ||
        config.backupRetentionDays > 365
      ) {
        errors.push({
          field: "backupRetentionDays",
          code: "BACKUP_RETENTION_OUT_OF_RANGE",
          message: "Backup retention must be between 1 and 365 days",
          severity: "error",
        });
      }
    }

    if (config.logLevel !== undefined) {
      const validLogLevels = ["error", "warn", "info", "debug"];
      if (!validLogLevels.includes(config.logLevel)) {
        errors.push({
          field: "logLevel",
          code: "INVALID_LOG_LEVEL",
          message: `Log level must be one of: ${validLogLevels.join(", ")}`,
          severity: "error",
        });
      }
    }

    if (config.uiTheme !== undefined) {
      const validThemes = ["light", "dark", "auto"];
      if (!validThemes.includes(config.uiTheme)) {
        errors.push({
          field: "uiTheme",
          code: "INVALID_UI_THEME",
          message: `UI theme must be one of: ${validThemes.join(", ")}`,
          severity: "error",
        });
      }
    }

    if (config.wikiOutputFormat !== undefined) {
      const validFormats = ["markdown", "html", "pdf"];
      if (!validFormats.includes(config.wikiOutputFormat)) {
        errors.push({
          field: "wikiOutputFormat",
          code: "INVALID_OUTPUT_FORMAT",
          message: `Wiki output format must be one of: ${validFormats.join(", ")}`,
          severity: "error",
        });
      }
    }

    if (config.language !== undefined) {
      if (typeof config.language !== "string" || config.language.length !== 2) {
        errors.push({
          field: "language",
          code: "INVALID_LANGUAGE_CODE",
          message: "Language must be a valid 2-letter ISO code",
          severity: "error",
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getSchemaForProvider(providerId: string): ConfigurationSchema {
    return this.providerSchemas.get(providerId) || this.createGenericProviderSchema();
  }

  getSchemaForGlobal(): ConfigurationSchema {
    return this.globalSchema;
  }

  private validateAgainstSchema(
    config: any,
    schema: ConfigurationSchema,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    for (const field of schema.fields) {
      const value = config[field.name];

      if (field.required && (value === undefined || value === null)) {
        errors.push({
          field: field.name,
          code: "REQUIRED_FIELD_MISSING",
          message: `Field ${field.name} is required`,
          severity: "error",
        });
        continue;
      }

      if (value !== undefined) {
        this.validateField(value, field, errors, warnings);
      }
    }

    if (schema.dependencies) {
      for (const dependency of schema.dependencies) {
        const dependentValue = config[dependency.dependsOn];
        if (dependentValue !== undefined && dependency.condition(dependentValue)) {
          const fieldValue = config[dependency.field];
          if (fieldValue === undefined || fieldValue === null) {
            errors.push({
              field: dependency.field,
              code: "DEPENDENT_FIELD_MISSING",
              message: `Field ${dependency.field} is required when ${dependency.dependsOn} has this value`,
              severity: "error",
            });
          }
        }
      }
    }
  }

  private validateField(
    value: any,
    field: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    if (field.type === "string" && typeof value !== "string") {
      errors.push({
        field: field.name,
        code: "INVALID_TYPE",
        message: `Field ${field.name} must be a string`,
        severity: "error",
      });
      return;
    }

    if (field.type === "number" && typeof value !== "number") {
      errors.push({
        field: field.name,
        code: "INVALID_TYPE",
        message: `Field ${field.name} must be a number`,
        severity: "error",
      });
      return;
    }

    if (field.type === "boolean" && typeof value !== "boolean") {
      errors.push({
        field: field.name,
        code: "INVALID_TYPE",
        message: `Field ${field.name} must be a boolean`,
        severity: "error",
      });
      return;
    }

    if (field.type === "array" && !Array.isArray(value)) {
      errors.push({
        field: field.name,
        code: "INVALID_TYPE",
        message: `Field ${field.name} must be an array`,
        severity: "error",
      });
      return;
    }

    if (
      field.type === "object" &&
      (typeof value !== "object" || Array.isArray(value) || value === null)
    ) {
      errors.push({
        field: field.name,
        code: "INVALID_TYPE",
        message: `Field ${field.name} must be an object`,
        severity: "error",
      });
      return;
    }

    if (field.validation) {
      if (field.type === "number") {
        if (field.validation.min !== undefined && value < field.validation.min) {
          errors.push({
            field: field.name,
            code: "VALUE_TOO_SMALL",
            message: `Field ${field.name} must be at least ${field.validation.min}`,
            severity: "error",
          });
        }
        if (field.validation.max !== undefined && value > field.validation.max) {
          errors.push({
            field: field.name,
            code: "VALUE_TOO_LARGE",
            message: `Field ${field.name} must be at most ${field.validation.max}`,
            severity: "error",
          });
        }
      }

      if (field.type === "string" && field.validation.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          errors.push({
            field: field.name,
            code: "INVALID_FORMAT",
            message: `Field ${field.name} does not match required pattern`,
            severity: "error",
          });
        }
      }

      if (field.validation.enum && !field.validation.enum.includes(value)) {
        errors.push({
          field: field.name,
          code: "INVALID_ENUM_VALUE",
          message: `Field ${field.name} must be one of: ${field.validation.enum.join(", ")}`,
          severity: "error",
        });
      }

      if (field.validation.custom && !field.validation.custom(value)) {
        errors.push({
          field: field.name,
          code: "CUSTOM_VALIDATION_FAILED",
          message: `Field ${field.name} failed custom validation`,
          severity: "error",
        });
      }
    }
  }

  private createGenericProviderSchema(): ConfigurationSchema {
    return {
      version: "1.0.0",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Unique provider identifier",
        },
        {
          name: "name",
          type: "string",
          required: true,
          description: "Display name of the provider",
        },
        {
          name: "enabled",
          type: "boolean",
          required: true,
          defaultValue: true,
          description: "Whether the provider is enabled",
        },
        {
          name: "apiKey",
          type: "string",
          required: false,
          description: "API key for authentication",
        },
        {
          name: "model",
          type: "string",
          required: false,
          description: "Default model to use",
        },
        {
          name: "temperature",
          type: "number",
          required: false,
          validation: { min: 0, max: 2 },
          description: "Temperature for generation (0-2)",
        },
        {
          name: "maxTokens",
          type: "number",
          required: false,
          validation: { min: 1, max: 32000 },
          description: "Maximum tokens to generate",
        },
      ],
    };
  }

  private initializeSchemas(): void {
    this.providerSchemas.set("openai", {
      version: "1.0.0",
      fields: [
        {
          name: "apiKey",
          type: "string",
          required: true,
          validation: { pattern: "^sk-[A-Za-z0-9]{48}$" },
          description: "OpenAI API key (starts with sk-)",
        },
        {
          name: "model",
          type: "string",
          required: true,
          validation: { enum: ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o"] },
          description: "OpenAI model to use",
        },
        {
          name: "temperature",
          type: "number",
          required: false,
          validation: { min: 0, max: 2 },
          defaultValue: 0.7,
          description: "Temperature for generation",
        },
        {
          name: "maxTokens",
          type: "number",
          required: false,
          validation: { min: 1, max: 4096 },
          defaultValue: 1000,
          description: "Maximum tokens to generate",
        },
      ],
    });

    this.providerSchemas.set("anthropic", {
      version: "1.0.0",
      fields: [
        {
          name: "apiKey",
          type: "string",
          required: true,
          validation: { pattern: "^sk-ant-api03-[A-Za-z0-9_-]{95}$" },
          description: "Anthropic API key",
        },
        {
          name: "model",
          type: "string",
          required: true,
          validation: {
            enum: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
          },
          description: "Claude model to use",
        },
        {
          name: "temperature",
          type: "number",
          required: false,
          validation: { min: 0, max: 1 },
          defaultValue: 0.5,
          description: "Temperature for generation",
        },
        {
          name: "maxTokens",
          type: "number",
          required: false,
          validation: { min: 1, max: 4096 },
          defaultValue: 1000,
          description: "Maximum tokens to generate",
        },
      ],
    });

    this.globalSchema = {
      version: "1.0.0",
      fields: [
        {
          name: "defaultProviderId",
          type: "string",
          required: false,
          description: "Default provider to use",
        },
        {
          name: "autoGenerateWiki",
          type: "boolean",
          required: true,
          defaultValue: false,
          description: "Automatically generate wiki on file changes",
        },
        {
          name: "wikiOutputFormat",
          type: "string",
          required: true,
          defaultValue: "markdown",
          validation: { enum: ["markdown", "html", "pdf"] },
          description: "Default output format for wiki",
        },
        {
          name: "maxContextLength",
          type: "number",
          required: true,
          defaultValue: 10000,
          validation: { min: 1000, max: 100000 },
          description: "Maximum context length for generation",
        },
        {
          name: "enableCaching",
          type: "boolean",
          required: true,
          defaultValue: true,
          description: "Enable caching of generated content",
        },
        {
          name: "cacheExpirationHours",
          type: "number",
          required: true,
          defaultValue: 24,
          validation: { min: 1, max: 168 },
          description: "Cache expiration time in hours",
        },
        {
          name: "enablePerformanceMonitoring",
          type: "boolean",
          required: true,
          defaultValue: true,
          description: "Enable performance monitoring",
        },
        {
          name: "enableErrorReporting",
          type: "boolean",
          required: true,
          defaultValue: true,
          description: "Enable error reporting",
        },
        {
          name: "logLevel",
          type: "string",
          required: true,
          defaultValue: "error",
          validation: { enum: ["error", "warn", "info", "debug"] },
          description: "Logging level",
        },
        {
          name: "uiTheme",
          type: "string",
          required: true,
          defaultValue: "auto",
          validation: { enum: ["light", "dark", "auto"] },
          description: "UI theme",
        },
        {
          name: "language",
          type: "string",
          required: true,
          defaultValue: "en",
          validation: { pattern: "^[a-z]{2}$" },
          description: "Language code (ISO 639-1)",
        },
        {
          name: "autoSave",
          type: "boolean",
          required: true,
          defaultValue: true,
          description: "Automatically save generated wiki",
        },
        {
          name: "backupEnabled",
          type: "boolean",
          required: true,
          defaultValue: true,
          description: "Enable configuration backup",
        },
        {
          name: "backupRetentionDays",
          type: "number",
          required: true,
          defaultValue: 30,
          validation: { min: 1, max: 365 },
          description: "Number of days to retain backups",
        },
      ],
    };
  }
}
