import { ConfigurationKeys, ConfigurationDefaults } from "../../constants";

export interface ConfigurationSchema {
  [ConfigurationKeys.zaiBaseUrl]: string;
  [ConfigurationKeys.googleAIEndpoint]: "openai-compatible" | "native";
}

export interface ConfigurationValidationRule {
  required?: boolean;
  type: "string" | "number" | "boolean" | "enum";
  enumValues?: string[];
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  defaultValue?: any;
}

export interface ConfigurationValidationRules {
  [key: string]: ConfigurationValidationRule;
}

export const ConfigurationValidationRules: ConfigurationValidationRules = {
  [ConfigurationKeys.zaiBaseUrl]: {
    type: "string",
    required: false,
    defaultValue: ConfigurationDefaults[ConfigurationKeys.zaiBaseUrl],
    pattern: /^https?:\/\/.+/,
  },
  [ConfigurationKeys.googleAIEndpoint]: {
    type: "enum",
    required: true,
    enumValues: ["openai-compatible", "native"],
    defaultValue: ConfigurationDefaults[ConfigurationKeys.googleAIEndpoint],
  },
};

export interface ConfigurationValidationError {
  key: string;
  message: string;
  value: any;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: ConfigurationValidationError[];
}