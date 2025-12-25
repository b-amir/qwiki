import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import type {
  ValidationResult,
  ValidationError,
  ConfigurationSchema,
  SchemaField,
} from "@/domain/configuration";
import { ConfigurationError } from "@/errors";
import { Result, ok, err } from "@/domain/types";

export class ConfigurationValidator {
  private logger: Logger;

  constructor(loggingService: LoggingService) {
    this.logger = createLogger("ConfigurationValidator");
  }

  validateConfiguration(
    config: Record<string, unknown>,
    schema: ConfigurationSchema,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

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

      if (value !== undefined && field.validation) {
        this.validateFieldValue(value, field, errors, warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateFieldValue(
    value: unknown,
    field: SchemaField,
    errors: ValidationError[],
    warnings: ValidationError[],
  ): void {
    if (field.type === "number") {
      if (typeof value !== "number") {
        errors.push({
          field: field.name,
          code: "INVALID_TYPE",
          message: `Field ${field.name} must be a number`,
          severity: "error",
        });
        return;
      }

      if (field.validation?.min !== undefined && value < field.validation.min) {
        errors.push({
          field: field.name,
          code: "VALUE_TOO_SMALL",
          message: `Field ${field.name} must be at least ${field.validation.min}`,
          severity: "error",
        });
      }

      if (field.validation?.max !== undefined && value > field.validation.max) {
        errors.push({
          field: field.name,
          code: "VALUE_TOO_LARGE",
          message: `Field ${field.name} must be at most ${field.validation.max}`,
          severity: "error",
        });
      }
    }

    if (field.type === "string") {
      if (typeof value !== "string") {
        errors.push({
          field: field.name,
          code: "INVALID_TYPE",
          message: `Field ${field.name} must be a string`,
          severity: "error",
        });
        return;
      }

      if (field.validation?.pattern) {
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

    if (field.validation?.enum && !field.validation.enum.includes(value)) {
      errors.push({
        field: field.name,
        code: "INVALID_ENUM_VALUE",
        message: `Field ${field.name} must be one of: ${field.validation.enum.join(", ")}`,
        severity: "error",
      });
    }

    if (field.validation?.custom && !field.validation.custom(value)) {
      errors.push({
        field: field.name,
        code: "CUSTOM_VALIDATION_FAILED",
        message: `Field ${field.name} failed custom validation`,
        severity: "error",
      });
    }
  }

  formatValidationErrors(errors: ValidationError[]): string {
    if (errors.length === 0) {
      return "Configuration validation failed";
    }

    if (errors.length === 1) {
      const error = errors[0];
      if (!error) {
        return "Configuration validation failed";
      }
      return error.field ? `${error.field}: ${error.message}` : error.message;
    }

    const fieldErrors = errors
      .filter((e) => e.field)
      .map((e) => `${e.field}: ${e.message}`)
      .join("; ");

    const generalErrors = errors
      .filter((e) => !e.field)
      .map((e) => e.message)
      .join("; ");

    const parts: string[] = [];
    if (fieldErrors) parts.push(fieldErrors);
    if (generalErrors) parts.push(generalErrors);

    return parts.length > 0 ? parts.join(". ") : "Configuration validation failed";
  }

  createProviderSchema(providerId: string): ConfigurationSchema {
    return {
      version: "1.0.0",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Provider identifier",
        },
        {
          name: "name",
          type: "string",
          required: true,
          description: "Provider display name",
        },
        {
          name: "enabled",
          type: "boolean",
          required: true,
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
          description: "Temperature for generation",
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

  throwIfInvalid(validationResult: ValidationResult, providerId: string): void {
    if (!validationResult.isValid) {
      const errorMessages = this.formatValidationErrors(validationResult.errors);
      throw new ConfigurationError("invalidConfiguration", errorMessages, {
        providerId,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    }
  }

  validateAndReturnResult(
    config: Record<string, unknown>,
    schema: ConfigurationSchema,
    providerId: string,
  ): Result<void, ConfigurationError> {
    const validationResult = this.validateConfiguration(config, schema);
    if (validationResult.isValid) {
      return ok(undefined);
    }
    const errorMessages = this.formatValidationErrors(validationResult.errors);
    return err(
      new ConfigurationError("invalidConfiguration", errorMessages, {
        providerId,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      }),
    );
  }
}
