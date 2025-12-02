import type { TemplateVariable } from "@/application/services/configuration/ConfigurationTemplateService";

export class TemplateVariableValidator {
  validateVariableValue(variable: TemplateVariable, value: unknown): unknown {
    if (variable.type === "string" && typeof value !== "string") {
      throw new Error(`Variable ${variable.name} must be a string`);
    }

    if (variable.type === "number" && typeof value !== "number") {
      throw new Error(`Variable ${variable.name} must be a number`);
    }

    if (variable.type === "boolean" && typeof value !== "boolean") {
      throw new Error(`Variable ${variable.name} must be a boolean`);
    }

    if (variable.type === "array" && !Array.isArray(value)) {
      throw new Error(`Variable ${variable.name} must be an array`);
    }

    if (variable.type === "object" && (typeof value !== "object" || Array.isArray(value))) {
      throw new Error(`Variable ${variable.name} must be an object`);
    }

    if (variable.validation) {
      if (variable.validation.pattern && typeof value === "string") {
        const regex = new RegExp(variable.validation.pattern);
        if (!regex.test(value)) {
          throw new Error(`Variable ${variable.name} does not match required pattern`);
        }
      }

      if (variable.validation.min !== undefined && typeof value === "number") {
        if (value < variable.validation.min) {
          throw new Error(`Variable ${variable.name} must be at least ${variable.validation.min}`);
        }
      }

      if (variable.validation.max !== undefined && typeof value === "number") {
        if (value > variable.validation.max) {
          throw new Error(`Variable ${variable.name} must be at most ${variable.validation.max}`);
        }
      }

      if (variable.validation.enum && !variable.validation.enum.includes(value)) {
        throw new Error(
          `Variable ${variable.name} must be one of: ${variable.validation.enum.join(", ")}`,
        );
      }
    }

    return value;
  }
}
