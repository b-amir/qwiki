import type {
  ValidationRule,
  ValidationContext,
} from "../../services/configuration/ConfigurationValidationEngineService";
import type { ValidationError, ValidationWarning } from "@/domain/configuration";

export function createCustomValidationRules(): ValidationRule[] {
  return [
    {
      id: "custom-api-key-required",
      name: "API Key Required",
      description: "Validates that API key is present and properly formatted",
      priority: 1,
      field: "apiKey",
      condition: (value: unknown, context: ValidationContext) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value: unknown, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (!value || typeof value !== "string" || value.trim().length === 0) {
          return { isValid: true, errors, warnings };
        }

        if (value.length < 5) {
          errors.push({
            field: "apiKey",
            code: "API_KEY_TOO_SHORT",
            message: "API key appears to be too short",
            severity: "error",
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
    {
      id: "custom-endpoint-required",
      name: "Endpoint URL Required",
      description: "Validates that endpoint URL is provided and properly formatted",
      priority: 2,
      field: "customEndpoint",
      condition: (value: unknown, context: ValidationContext) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value: unknown, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (!value || typeof value !== "string" || value.trim().length === 0) {
          errors.push({
            field: "customEndpoint",
            code: "ENDPOINT_REQUIRED",
            message: "Custom endpoint URL is required",
            severity: "error",
          });
          return { isValid: false, errors, warnings };
        }

        try {
          const url = new URL(value);
          if (url.protocol !== "https:" && url.protocol !== "http:") {
            errors.push({
              field: "customEndpoint",
              code: "ENDPOINT_INVALID_PROTOCOL",
              message: "Endpoint URL must use http or https protocol",
              severity: "error",
            });
          }
        } catch {
          errors.push({
            field: "customEndpoint",
            code: "ENDPOINT_INVALID_FORMAT",
            message: "Endpoint must be a valid URL",
            severity: "error",
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
    {
      id: "custom-model-required",
      name: "Model Name Required",
      description: "Validates that model name is provided",
      priority: 3,
      field: "customModel",
      condition: (value: unknown, context: ValidationContext) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value: unknown, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (!value || typeof value !== "string" || value.trim().length === 0) {
          errors.push({
            field: "customModel",
            code: "MODEL_NAME_REQUIRED",
            message: "Custom model name is required",
            severity: "error",
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
  ];
}
