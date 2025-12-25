import type {
  ValidationRule,
  ValidationContext,
} from "../../services/configuration/ConfigurationValidationEngineService";
import type { ValidationError, ValidationWarning } from "@/domain/configuration";
import { ValidationConstants } from "@/constants/ValidationConstants";

export function createCommonValidationRules(): ValidationRule[] {
  return [
    {
      id: "common-temperature-range",
      name: "Common Temperature Range Validation",
      description: "Validates temperature is within acceptable range for all providers",
      priority: 5,
      field: "temperature",
      condition: (value: unknown, context: ValidationContext) => value !== undefined,
      validator: (value: unknown, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (typeof value !== "number") {
          errors.push({
            field: "temperature",
            code: "TEMPERATURE_INVALID_TYPE",
            message: "Temperature must be a number",
            severity: "error",
          });
        } else if (value < ValidationConstants.TEMPERATURE.MIN || value > ValidationConstants.TEMPERATURE.MAX) {
          errors.push({
            field: "temperature",
            code: "TEMPERATURE_OUT_OF_RANGE",
            message: `Temperature must be between ${ValidationConstants.TEMPERATURE.MIN} and ${ValidationConstants.TEMPERATURE.MAX}`,
            severity: "error",
          });
        } else if (value > ValidationConstants.TEMPERATURE.WARNING_THRESHOLD) {
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
      condition: (value: unknown, context: ValidationContext) => value !== undefined,
      validator: (value: unknown, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (typeof value !== "number") {
          errors.push({
            field: "maxTokens",
            code: "MAX_TOKENS_INVALID_TYPE",
            message: "Max tokens must be a number",
            severity: "error",
          });
        } else if (value < ValidationConstants.MAX_TOKENS.MIN) {
          errors.push({
            field: "maxTokens",
            code: "MAX_TOKENS_TOO_SMALL",
            message: `Max tokens must be at least ${ValidationConstants.MAX_TOKENS.MIN}`,
            severity: "error",
          });
        } else if (value > ValidationConstants.MAX_TOKENS.ABSOLUTE_MAX) {
          errors.push({
            field: "maxTokens",
            code: "MAX_TOKENS_TOO_LARGE",
            message: `Max tokens cannot exceed ${ValidationConstants.MAX_TOKENS.ABSOLUTE_MAX}`,
            severity: "error",
          });
        } else if (value > ValidationConstants.MAX_TOKENS.WARNING_THRESHOLD) {
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
      condition: (value: unknown, context: ValidationContext) => value !== undefined,
      validator: (value: unknown, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (typeof value !== "number") {
          errors.push({
            field: "rateLimitPerMinute",
            code: "RATE_LIMIT_INVALID_TYPE",
            message: "Rate limit must be a number",
            severity: "error",
          });
        } else if (value < ValidationConstants.RATE_LIMIT.MIN) {
          errors.push({
            field: "rateLimitPerMinute",
            code: "RATE_LIMIT_TOO_SMALL",
            message: `Rate limit must be at least ${ValidationConstants.RATE_LIMIT.MIN} request per minute`,
            severity: "error",
          });
        } else if (value > ValidationConstants.RATE_LIMIT.WARNING_THRESHOLD) {
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
