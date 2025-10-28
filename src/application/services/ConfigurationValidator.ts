import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import { ConfigurationError } from "../../errors";
import {
  ConfigurationValidationRules,
  ConfigurationValidationResult,
  ConfigurationValidationError,
} from "./ConfigurationSchema";

export class ConfigurationValidator {
  constructor(private configurationRepository: ConfigurationRepository) {}

  async validateConfiguration(): Promise<ConfigurationValidationResult> {
    const config = await this.configurationRepository.getAll();
    const errors: ConfigurationValidationError[] = [];

    for (const [key, rule] of Object.entries(ConfigurationValidationRules)) {
      const value = config[key];
      const validationError = this.validateValue(key, value, rule);
      
      if (validationError) {
        errors.push(validationError);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async validateKey(key: string): Promise<ConfigurationValidationResult> {
    const rule = ConfigurationValidationRules[key];
    if (!rule) {
      return {
        isValid: false,
        errors: [{ key, message: "Unknown configuration key", value: undefined }],
      };
    }

    const value = await this.configurationRepository.get(key);
    const validationError = this.validateValue(key, value, rule);

    return {
      isValid: !validationError,
      errors: validationError ? [validationError] : [],
    };
  }

  private validateValue(key: string, value: any, rule: any): ConfigurationValidationError | null {
    if (value === undefined || value === null) {
      if (rule.required) {
        return {
          key,
          message: `Configuration key '${key}' is required`,
          value,
        };
      }
      return null;
    }

    if (rule.type === "string") {
      if (typeof value !== "string") {
        return {
          key,
          message: `Configuration key '${key}' must be a string`,
          value,
        };
      }

      if (rule.minLength && value.length < rule.minLength) {
        return {
          key,
          message: `Configuration key '${key}' must be at least ${rule.minLength} characters long`,
          value,
        };
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        return {
          key,
          message: `Configuration key '${key}' must be at most ${rule.maxLength} characters long`,
          value,
        };
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        return {
          key,
          message: `Configuration key '${key}' has invalid format`,
          value,
        };
      }
    }

    if (rule.type === "enum" && rule.enumValues) {
      if (!rule.enumValues.includes(value)) {
        return {
          key,
          message: `Configuration key '${key}' must be one of: ${rule.enumValues.join(", ")}`,
          value,
        };
      }
    }

    if (rule.type === "number" && typeof value !== "number") {
      return {
        key,
        message: `Configuration key '${key}' must be a number`,
        value,
      };
    }

    if (rule.type === "boolean" && typeof value !== "boolean") {
      return {
        key,
        message: `Configuration key '${key}' must be a boolean`,
        value,
      };
    }

    return null;
  }

  async validateAndFix(): Promise<void> {
    const result = await this.validateConfiguration();
    
    if (!result.isValid) {
      for (const error of result.errors) {
        await this.fixConfigurationError(error);
      }
    }
  }

  private async fixConfigurationError(error: ConfigurationValidationError): Promise<void> {
    const rule = ConfigurationValidationRules[error.key];
    if (rule && rule.defaultValue !== undefined) {
      await this.configurationRepository.set(error.key, rule.defaultValue);
    } else {
      throw new ConfigurationError(
        "invalidConfiguration",
        `Invalid configuration for '${error.key}': ${error.message}`
      );
    }
  }
}