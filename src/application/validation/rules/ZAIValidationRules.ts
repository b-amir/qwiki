import type {
  ValidationRule,
  ValidationContext,
} from "../../services/configuration/ConfigurationValidationEngineService";
import type { ValidationError, ValidationWarning } from "@/domain/configuration";

export function createZAIValidationRules(): ValidationRule[] {
  return [
    {
      id: "zai-api-key-required",
      name: "API Key Required",
      description: "Validates that API key is present and properly formatted",
      priority: 1,
      field: "apiKey",
      condition: (value: any, context: ValidationContext) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value: any, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (!value || typeof value !== "string" || value.trim().length === 0) {
          return { isValid: true, errors, warnings };
        }

        if (value.length < 10) {
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
      id: "zai-model-validation",
      name: "Model Validation",
      description: "Validates that the model is supported",
      priority: 2,
      field: "model",
      condition: (value: any, context: ValidationContext) => value !== undefined,
      validator: (value: any, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validModels = [
          "glm-4.5-flash",
          "glm-4.5",
          "glm-4.5-air",
          "glm-4.5-airx",
          "glm-4.5-x",
          "glm-4.6",
          "glm-4-32b-0414-128k",
        ];

        if (typeof value !== "string") {
          errors.push({
            field: "model",
            code: "MODEL_INVALID_TYPE",
            message: "Model must be a string",
            severity: "error",
          });
        } else if (!validModels.includes(value)) {
          warnings.push({
            field: "model",
            code: "MODEL_UNKNOWN",
            message: `Unknown model "${value}". Valid models: ${validModels.join(", ")}`,
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
    {
      id: "zai-base-url-validation",
      name: "Base URL Validation",
      description: "Validates base URL format if provided",
      priority: 4,
      field: "zaiBaseUrl",
      condition: (value, context) => value !== undefined && value !== "",
      validator: (value, context) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        if (typeof value !== "string") {
          errors.push({
            field: "zaiBaseUrl",
            code: "BASE_URL_INVALID_TYPE",
            message: "Base URL must be a string",
            severity: "error",
          });
        } else {
          try {
            new URL(value);
          } catch {
            errors.push({
              field: "zaiBaseUrl",
              code: "BASE_URL_INVALID_FORMAT",
              message: "Base URL must be a valid URL",
              severity: "error",
            });
          }
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
  ];
}
