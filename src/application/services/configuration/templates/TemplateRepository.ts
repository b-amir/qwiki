import type { ConfigurationTemplate } from "@/domain/configuration";

export class TemplateRepository {
  private templates = new Map<string, ConfigurationTemplate>();

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

  hasTemplate(templateId: string): boolean {
    return this.templates.has(templateId);
  }
}
