import type {
  ConfigurationTemplate,
  TemplateMetadata,
  ValidationResult,
} from "@/domain/configuration";
import type { ConfigurationValidationEngineService } from "@/application/services/configuration/ConfigurationValidationEngineService";
import { TemplateRepository } from "@/application/services/configuration/templates/TemplateRepository";
import { TemplateResolver } from "@/application/services/configuration/templates/TemplateResolver";
import { TemplateVariableValidator } from "@/application/services/configuration/templates/TemplateVariableValidator";
import { TemplateMerger } from "@/application/services/configuration/templates/TemplateMerger";
import { TemplateValidator } from "@/application/services/configuration/templates/TemplateValidator";

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
  private templateRepository: TemplateRepository;
  private templateVariables = new Map<string, TemplateVariable[]>();
  private templateInheritance = new Map<string, TemplateInheritance>();
  private templateComposition = new Map<string, TemplateComposition>();
  private variableValidator: TemplateVariableValidator;
  private templateMerger: TemplateMerger;
  private templateValidator: TemplateValidator;
  private templateResolver: TemplateResolver;

  constructor(private validationEngine: ConfigurationValidationEngineService) {
    this.templateRepository = new TemplateRepository();
    this.variableValidator = new TemplateVariableValidator();
    this.templateMerger = new TemplateMerger();
    this.templateValidator = new TemplateValidator(this.validationEngine);
    this.templateResolver = new TemplateResolver(
      this.variableValidator,
      this.templateMerger,
      (id) => this.templateRepository.getTemplate(id),
      (id) => this.templateVariables.get(id) || [],
      (id) => this.templateInheritance.get(id),
      (id) => this.templateComposition.get(id),
    );
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

    this.templateRepository.saveTemplate(template);
    return template;
  }

  async applyTemplate(templateId: string, variables: Record<string, any>): Promise<void> {
    const template = this.templateRepository.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    const resolvedTemplate = await this.templateResolver.resolveTemplate(template, variables);
    const validationResult = this.templateValidator.validateTemplate(resolvedTemplate);

    if (!validationResult.isValid) {
      throw new Error(
        `Template validation failed: ${validationResult.errors.map((e: any) => e.message).join(", ")}`,
      );
    }

    await this.templateRepository.saveTemplate(resolvedTemplate);
  }

  validateTemplate(template: ConfigurationTemplate): ValidationResult {
    return this.templateValidator.validateTemplate(template);
  }

  getAvailableTemplates(): ConfigurationTemplate[] {
    return this.templateRepository.getAvailableTemplates();
  }

  getTemplate(templateId: string): ConfigurationTemplate | undefined {
    return this.templateRepository.getTemplate(templateId);
  }

  async saveTemplate(template: ConfigurationTemplate): Promise<void> {
    await this.templateRepository.saveTemplate(template);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.templateRepository.deleteTemplate(templateId);
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
    const template = this.templateRepository.getTemplate(templateId);
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
    await this.templateRepository.saveTemplate(migratedTemplate);
    return migratedTemplate;
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

    this.templateRepository.saveTemplate(emptyTemplate);
  }
}
