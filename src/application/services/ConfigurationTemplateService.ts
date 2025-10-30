import type {
  ConfigurationTemplate,
  TemplateMetadata,
  ValidationResult,
  GlobalConfiguration,
  ProviderConfigurationMap,
  ProviderConfiguration,
} from "../../domain/configuration";
import type {
  ConfigurationValidationEngine,
  ValidationContext,
} from "./ConfigurationValidationEngine";

export interface TemplateVariable {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
  };
}

export interface TemplateInheritance {
  parentId: string;
  overrides: Partial<ConfigurationTemplate>;
}

export interface TemplateComposition {
  templates: string[];
  mergeStrategy: "deep" | "shallow" | "replace";
}

export class ConfigurationTemplateService {
  private templates = new Map<string, ConfigurationTemplate>();
  private templateVariables = new Map<string, TemplateVariable[]>();
  private templateInheritance = new Map<string, TemplateInheritance>();
  private templateComposition = new Map<string, TemplateComposition>();

  constructor(private validationEngine: ConfigurationValidationEngine) {
    this.initializeBuiltinTemplates();
  }

  createTemplate(
    config: any,
    metadata: TemplateMetadata & { version?: string; compatibleProviders?: string[] },
  ): ConfigurationTemplate {
    const template: ConfigurationTemplate = {
      id: this.generateTemplateId(metadata.name),
      name: metadata.name,
      description: metadata.description,
      category: metadata.category as "development" | "production" | "enterprise" | "custom",
      configuration: {
        global: config.global || {},
        providers: config.providers || {},
      },
      metadata: {
        author: metadata.author,
        version: metadata.version || "1.0.0",
        tags: metadata.tags || [],
        compatibleProviders: metadata.compatibleProviders || [],
      },
    };

    this.templates.set(template.id, template);
    return template;
  }

  async applyTemplate(templateId: string, variables: Record<string, any>): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    const resolvedTemplate = await this.resolveTemplate(template, variables);
    const validationResult = await this.validateTemplate(resolvedTemplate);

    if (!validationResult.isValid) {
      throw new Error(
        `Template validation failed: ${validationResult.errors.map((e) => e.message).join(", ")}`,
      );
    }

    await this.saveTemplate(resolvedTemplate);
  }

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

  getAvailableTemplates(): ConfigurationTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(templateId: string): ConfigurationTemplate | undefined {
    return this.templates.get(templateId);
  }

  async saveTemplate(template: ConfigurationTemplate): Promise<void> {
    this.templates.set(template.id, template);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    if (template.category !== "custom") {
      throw new Error("Cannot delete built-in templates");
    }

    this.templates.delete(templateId);
  }

  addTemplateVariable(templateId: string, variable: TemplateVariable): void {
    const variables = this.templateVariables.get(templateId) || [];
    variables.push(variable);
    this.templateVariables.set(templateId, variables);
  }

  getTemplateVariables(templateId: string): TemplateVariable[] {
    return this.templateVariables.get(templateId) || [];
  }

  setTemplateInheritance(templateId: string, inheritance: TemplateInheritance): void {
    this.templateInheritance.set(templateId, inheritance);
  }

  getTemplateInheritance(templateId: string): TemplateInheritance | undefined {
    return this.templateInheritance.get(templateId);
  }

  setTemplateComposition(templateId: string, composition: TemplateComposition): void {
    this.templateComposition.set(templateId, composition);
  }

  getTemplateComposition(templateId: string): TemplateComposition | undefined {
    return this.templateComposition.get(templateId);
  }

  async migrateTemplate(templateId: string, targetVersion: string): Promise<ConfigurationTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    const currentVersion = template.metadata.version;
    if (currentVersion === targetVersion) {
      return template;
    }

    const migrationSteps = this.getMigrationSteps(currentVersion, targetVersion);
    let migratedTemplate = { ...template };

    for (const step of migrationSteps) {
      migratedTemplate = await step.migrate(migratedTemplate);
    }

    migratedTemplate.metadata.version = targetVersion;
    this.templates.set(templateId, migratedTemplate);
    return migratedTemplate;
  }

  private async resolveTemplate(
    template: ConfigurationTemplate,
    variables: Record<string, any>,
  ): Promise<ConfigurationTemplate> {
    const resolvedTemplate = JSON.parse(JSON.stringify(template));
    const templateVars = this.templateVariables.get(template.id) || [];

    for (const variable of templateVars) {
      if (variables[variable.name] !== undefined) {
        const value = this.validateVariableValue(variable, variables[variable.name]);
        this.substituteVariable(resolvedTemplate, variable.name, value);
      } else if (variable.required) {
        throw new Error(`Required variable ${variable.name} is missing`);
      } else if (variable.defaultValue !== undefined) {
        this.substituteVariable(resolvedTemplate, variable.name, variable.defaultValue);
      }
    }

    const inheritance = this.templateInheritance.get(template.id);
    if (inheritance) {
      const parentTemplate = await this.resolveTemplate(
        this.templates.get(inheritance.parentId)!,
        variables,
      );
      this.mergeTemplate(resolvedTemplate, parentTemplate, inheritance.overrides);
    }

    const composition = this.templateComposition.get(template.id);
    if (composition) {
      const composedTemplates = await Promise.all(
        composition.templates.map((t) => this.resolveTemplate(this.templates.get(t)!, variables)),
      );
      this.composeTemplates(resolvedTemplate, composedTemplates, composition.mergeStrategy);
    }

    return resolvedTemplate;
  }

  private substituteVariable(template: any, variableName: string, value: any): void {
    const templateString = JSON.stringify(template);
    const regex = new RegExp(`\\$\\{${variableName}\\}`, "g");
    const substituted = templateString.replace(regex, JSON.stringify(value));
    Object.assign(template, JSON.parse(substituted));
  }

  private validateVariableValue(variable: TemplateVariable, value: any): any {
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

  private mergeTemplate(
    target: ConfigurationTemplate,
    parent: ConfigurationTemplate,
    overrides: Partial<ConfigurationTemplate>,
  ): void {
    this.deepMerge(target.configuration.global, parent.configuration.global);
    this.deepMerge(target.configuration.providers, parent.configuration.providers);
    this.deepMerge(target, overrides);
  }

  private composeTemplates(
    target: ConfigurationTemplate,
    templates: ConfigurationTemplate[],
    strategy: "deep" | "shallow" | "replace",
  ): void {
    for (const template of templates) {
      if (strategy === "deep") {
        this.deepMerge(target.configuration.global, template.configuration.global);
        this.deepMerge(target.configuration.providers, template.configuration.providers);
      } else if (strategy === "shallow") {
        Object.assign(target.configuration.global, template.configuration.global);
        Object.assign(target.configuration.providers, template.configuration.providers);
      } else if (strategy === "replace") {
        target.configuration.global = { ...template.configuration.global };
        target.configuration.providers = { ...template.configuration.providers };
      }
    }
  }

  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
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

  private generateTemplateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private getMigrationSteps(fromVersion: string, toVersion: string): any[] {
    return [];
  }

  private initializeBuiltinTemplates(): void {
    const emptyTemplate: ConfigurationTemplate = {
      id: "empty",
      name: "Empty Template",
      description: "A blank template for creating custom configurations",
      category: "custom",
      configuration: {
        global: {},
        providers: {},
      },
      metadata: {
        author: "Qwiki",
        version: "1.0.0",
        tags: ["empty", "custom"],
        compatibleProviders: [],
      },
    };

    this.templates.set(emptyTemplate.id, emptyTemplate);
  }
}
