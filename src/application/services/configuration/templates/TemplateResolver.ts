import type { ConfigurationTemplate } from "@/domain/configuration";
import type {
  TemplateVariable,
  TemplateInheritance,
  TemplateComposition,
} from "../ConfigurationTemplateService";
import { TemplateVariableValidator } from "@/application/services/configuration/templates/TemplateVariableValidator";
import { TemplateMerger } from "@/application/services/configuration/templates/TemplateMerger";

export class TemplateResolver {
  constructor(
    private variableValidator: TemplateVariableValidator,
    private templateMerger: TemplateMerger,
    private getTemplate: (id: string) => ConfigurationTemplate | undefined,
    private getTemplateVariables: (id: string) => TemplateVariable[],
    private getTemplateInheritance: (id: string) => TemplateInheritance | undefined,
    private getTemplateComposition: (id: string) => TemplateComposition | undefined,
  ) {}

  async resolveTemplate(
    template: ConfigurationTemplate,
    variables: Record<string, any>,
  ): Promise<ConfigurationTemplate> {
    const resolvedTemplate = JSON.parse(JSON.stringify(template));
    const templateVars = this.getTemplateVariables(template.id);

    for (const variable of templateVars) {
      if (variables[variable.name] !== undefined) {
        const value = this.variableValidator.validateVariableValue(
          variable,
          variables[variable.name],
        );
        this.substituteVariable(resolvedTemplate, variable.name, value);
      } else if (variable.required) {
        throw new Error(`Required variable ${variable.name} is missing`);
      } else if (variable.defaultValue !== undefined) {
        this.substituteVariable(resolvedTemplate, variable.name, variable.defaultValue);
      }
    }

    const inheritance = this.getTemplateInheritance(template.id);
    if (inheritance) {
      const parentTemplate = await this.resolveTemplate(
        this.getTemplate(inheritance.parentId)!,
        variables,
      );
      this.templateMerger.mergeTemplate(resolvedTemplate, parentTemplate, inheritance.overrides);
    }

    const composition = this.getTemplateComposition(template.id);
    if (composition) {
      const composedTemplates = await Promise.all(
        composition.templates.map((t) => this.resolveTemplate(this.getTemplate(t)!, variables)),
      );
      this.templateMerger.composeTemplates(
        resolvedTemplate,
        composedTemplates,
        composition.mergeStrategy,
      );
    }

    return resolvedTemplate;
  }

  private substituteVariable(template: any, variableName: string, value: any): void {
    const templateString = JSON.stringify(template);
    const regex = new RegExp(`\\$\\{${variableName}\\}`, "g");
    const substituted = templateString.replace(regex, JSON.stringify(value));
    Object.assign(template, JSON.parse(substituted));
  }
}
