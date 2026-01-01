import type {
  ValidationRule,
  ValidationContext,
} from "../../services/configuration/ConfigurationValidationEngineService";
import type { ValidationError, ValidationWarning } from "@/domain/configuration";

export function createGoogleAIStudioValidationRules(): ValidationRule[] {
  return [
    {
      id: "google-ai-studio-api-key-required",
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
    {
      id: "google-ai-studio-model-validation",
      name: "Model Validation",
      description: "Validates that the model is supported",
      priority: 2,
      field: "model",
      condition: (value: unknown, context: ValidationContext) => value !== undefined,
      validator: (value: unknown, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validModels = [
          "gemini-2.5-pro",
          "gemini-2.5-flash",
          "gemini-3-pro",
          "gemini-3-flash",
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
      id: "google-ai-studio-temperature-range",
      name: "Temperature Range Validation",
      description: "Validates temperature is within acceptable range",
      priority: 3,
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
        } else if (value < 0 || value > 2) {
          errors.push({
            field: "temperature",
            code: "TEMPERATURE_OUT_OF_RANGE",
            message: "Temperature must be between 0 and 2",
            severity: "error",
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
    {
      id: "google-ai-studio-endpoint-validation",
      name: "Endpoint Type Validation",
      description: "Validates endpoint type is supported",
      priority: 4,
      field: "googleAIEndpoint",
      condition: (value: unknown, context: ValidationContext) => value !== undefined,
      validator: (value: unknown, context: ValidationContext) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validEndpoints = ["openai-compatible", "native"];

        if (typeof value !== "string") {
          errors.push({
            field: "googleAIEndpoint",
            code: "ENDPOINT_INVALID_TYPE",
            message: "Endpoint type must be a string",
            severity: "error",
          });
        } else if (!validEndpoints.includes(value)) {
          errors.push({
            field: "googleAIEndpoint",
            code: "ENDPOINT_INVALID",
            message: `Invalid endpoint "${value}". Valid endpoints: ${validEndpoints.join(", ")}`,
            severity: "error",
          });
        }

        return { isValid: errors.length === 0, errors, warnings };
      },
      enabled: true,
    },
  ];
}
