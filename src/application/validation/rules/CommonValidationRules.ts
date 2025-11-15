import type {
  ValidationRule,
  ValidationContext,
} from "../../services/configuration/ConfigurationValidationEngineService";
import type { ValidationError, ValidationWarning } from "@/domain/configuration";

export function createCommonValidationRules(): ValidationRule[] {
  return [
    {
      id: "common-temperature-range",
      name: "Common Temperature Range Validation",
      description: "Validates temperature is within acceptable range for all providers",
      priority: 5,
      field: "temperature",
      condition: (value: any, context: ValidationContext) => value !== undefined,
      validator: (value: any, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (typeof value !== "number") {
          errors.push({
            field: "temperature",
            code: "TEMPERATURE_INVALID_TYPE",
            message: "Temperature must be a number",
            severity: "error",
          });
        } else if (value < 0 || value > 2) {
          errors.push({
            field: "temperature",
            code: "TEMPERATURE_OUT_OF_RANGE",
            message: "Temperature must be between 0 and 2",
            severity: "error",
          });
        } else if (value > 1.5) {
          warnings.push({
            field: "temperature",
            code: "TEMPERATURE_HIGH",
            message: "High temperature values may result in less predictable output",
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
    {
      id: "common-max-tokens-range",
      name: "Common Max Tokens Range Validation",
      description: "Validates max tokens is within acceptable range",
      priority: 6,
      field: "maxTokens",
      condition: (value: any, context: ValidationContext) => value !== undefined,
      validator: (value: any, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (typeof value !== "number") {
          errors.push({
            field: "maxTokens",
            code: "MAX_TOKENS_INVALID_TYPE",
            message: "Max tokens must be a number",
            severity: "error",
          });
        } else if (value < 1) {
          errors.push({
            field: "maxTokens",
            code: "MAX_TOKENS_TOO_SMALL",
            message: "Max tokens must be at least 1",
            severity: "error",
          });
        } else if (value > 32000) {
          errors.push({
            field: "maxTokens",
            code: "MAX_TOKENS_TOO_LARGE",
            message: "Max tokens cannot exceed 32000",
            severity: "error",
          });
        } else if (value > 8000) {
          warnings.push({
            field: "maxTokens",
            code: "MAX_TOKENS_HIGH",
            message: "High max tokens values may increase cost and generation time",
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
    {
      id: "common-rate-limit-validation",
      name: "Common Rate Limit Validation",
      description: "Validates rate limit is reasonable",
      priority: 7,
      field: "rateLimitPerMinute",
      condition: (value: any, context: ValidationContext) => value !== undefined,
      validator: (value: any, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (typeof value !== "number") {
          errors.push({
            field: "rateLimitPerMinute",
            code: "RATE_LIMIT_INVALID_TYPE",
            message: "Rate limit must be a number",
            severity: "error",
          });
        } else if (value < 1) {
          errors.push({
            field: "rateLimitPerMinute",
            code: "RATE_LIMIT_TOO_SMALL",
            message: "Rate limit must be at least 1 request per minute",
            severity: "error",
          });
        } else if (value > 1000) {
          warnings.push({
            field: "rateLimitPerMinute",
            code: "RATE_LIMIT_HIGH",
            message: "Very high rate limits may trigger provider anti-spam measures",
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
  ];
}
