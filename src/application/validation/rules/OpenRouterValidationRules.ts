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
    {
      id: "openrouter-model-validation",
      name: "Model Validation",
      description: "Validates that the model is supported",
      priority: 2,
      field: "model",
      condition: (value: any, context: ValidationContext) => value !== undefined,
      validator: (value: any, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validModels = [
          "openai/gpt-oss-20b",
          "meta-llama/llama-3-8b-instruct",
          "microsoft/wizardlm-2-8x22b",
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
  ];
}
