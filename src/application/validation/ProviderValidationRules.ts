import type {
  ValidationRule,
  ValidationContext,
} from "../services/ConfigurationValidationEngineService";
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "../../domain/configuration";

export function createGoogleAIStudioValidationRules(): ValidationRule[] {
  return [
    {
      id: "google-ai-studio-api-key-required",
      name: "API Key Required",
      description: "Validates that API key is present and properly formatted",
      priority: 1,
      field: "apiKey",
      condition: (value, context) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value, context) => {
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
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validModels = ["gemini-2.5-pro", "gemini-2.5-flash"];

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
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
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
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
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

export function createZAIValidationRules(): ValidationRule[] {
  return [
    {
      id: "zai-api-key-required",
      name: "API Key Required",
      description: "Validates that API key is present and properly formatted",
      priority: 1,
      field: "apiKey",
      condition: (value, context) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value, context) => {
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
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
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

export function createOpenRouterValidationRules(): ValidationRule[] {
  return [
    {
      id: "openrouter-api-key-required",
      name: "API Key Required",
      description: "Validates that API key is present and properly formatted",
      priority: 1,
      field: "apiKey",
      condition: (value, context) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value, context) => {
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
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
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

export function createCohereValidationRules(): ValidationRule[] {
  return [
    {
      id: "cohere-api-key-required",
      name: "API Key Required",
      description: "Validates that API key is present and properly formatted",
      priority: 1,
      field: "apiKey",
      condition: (value, context) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value, context) => {
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
      id: "cohere-model-validation",
      name: "Model Validation",
      description: "Validates that the model is supported",
      priority: 2,
      field: "model",
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validModels = ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024"];

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

export function createHuggingFaceValidationRules(): ValidationRule[] {
  return [
    {
      id: "huggingface-api-key-required",
      name: "API Key Required",
      description: "Validates that API key is present and properly formatted",
      priority: 1,
      field: "apiKey",
      condition: (value, context) => {
        if (context.operation !== "create" && context.operation !== "update") return false;
        return value !== undefined && value !== null && value !== "";
      },
      validator: (value, context) => {
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
      id: "huggingface-model-validation",
      name: "Model Validation",
      description: "Validates that the model is supported",
      priority: 2,
      field: "model",
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];
        const validModels = [
          "bigscience/bloomz-7b1",
          "tiiuae/falcon-7b-instruct",
          "microsoft/CodeT5-base",
          "codellama/CodeLlama-7b-Instruct-hf",
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

export function createCommonValidationRules(): ValidationRule[] {
  return [
    {
      id: "common-temperature-range",
      name: "Common Temperature Range Validation",
      description: "Validates temperature is within acceptable range for all providers",
      priority: 5,
      field: "temperature",
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
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
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
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
      condition: (value, context) => value !== undefined,
      validator: (value, context) => {
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
