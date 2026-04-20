import type {
  ValidationRule,
  ValidationContext,
} from "../../services/configuration/ConfigurationValidationEngineService";
import type { ValidationError, ValidationWarning } from "@/domain/configuration";

export function createOpenRouterValidationRules(): ValidationRule[] {
  return [
    {
      id: "openrouter-api-key-required",
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

        if (value.length < 20) {
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
  ];
}
