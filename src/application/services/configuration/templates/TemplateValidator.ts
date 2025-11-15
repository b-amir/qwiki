import type { ConfigurationTemplate, ValidationResult } from "@/domain/configuration";
import type {
  ConfigurationValidationEngineService,
  ValidationContext,
} from "../ConfigurationValidationEngineService";

export class TemplateValidator {
  constructor(private validationEngine: ConfigurationValidationEngineService) {}

  validateTemplate(template: ConfigurationTemplate): ValidationResult {
    const context: ValidationContext = {
      configuration: template.configuration,
      operation: "create",
      timestamp: new Date(),
    };

    return this.validationEngine.validateConfiguration(
      template.configuration,
      this.createTemplateSchema(template),
      context,
    );
  }

  private createTemplateSchema(template: ConfigurationTemplate): any {
    return {
      version: "1.0.0",
      fields: [
        {
          name: "global",
          type: "object",
          required: true,
          description: "Global configuration settings",
        },
        {
          name: "providers",
          type: "object",
          required: true,
          description: "Provider configuration settings",
        },
      ],
    };
  }
}
