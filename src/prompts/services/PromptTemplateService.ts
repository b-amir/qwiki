import {
  PromptCategory,
  PromptComplexity,
  PromptContext,
  PromptMetadata,
  PromptTemplate,
  PromptVariable,
  PromptVersion,
} from "../types/PromptTypes";

interface StorageService<T> {
  create(collection: string, item: T): Promise<string>;
  update(collection: string, id: string, updates: Partial<T>): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  get(collection: string, id: string): Promise<T>;
  list(collection: string, filter?: Record<string, unknown>): Promise<T[]>;
}

interface VersionControlService<TVersion> {
  createVersion(resource: string, id: string, version: TVersion): Promise<string>;
  listVersions(resource: string, id: string): Promise<TVersion[]>;
  revertToVersion(resource: string, id: string, versionId: string): Promise<void>;
}

type TemplateRecord = PromptTemplate;

export class PromptTemplateService {
  private readonly collection = "promptTemplates";
  private readonly resource = "promptTemplate";

  constructor(
    private readonly storage: StorageService<TemplateRecord>,
    private readonly versioning: VersionControlService<PromptVersion>,
  ) {}

  async createTemplate(template: PromptTemplate): Promise<string> {
    this.validateTemplateObject(template);
    return this.storage.create(this.collection, template);
  }

  async updateTemplate(templateId: string, updates: Partial<PromptTemplate>): Promise<void> {
    if (updates.metadata) this.validateMetadata(updates.metadata);
    if (updates.variables) this.validateVariables(updates.variables);
    if (updates.content !== undefined && typeof updates.content !== "string")
      throw new Error("invalid_content");
    await this.storage.update(this.collection, templateId, updates);
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.storage.delete(this.collection, templateId);
  }

  async getTemplate(templateId: string): Promise<PromptTemplate> {
    return this.storage.get(this.collection, templateId);
  }

  async getAllTemplates(category?: PromptCategory): Promise<PromptTemplate[]> {
    const filter = category ? { "metadata.category": category } : undefined;
    return this.storage.list(this.collection, filter);
  }

  async renderTemplate(templateId: string, context: PromptContext): Promise<string> {
    const template = await this.getTemplate(templateId);
    this.validateVariables(template.variables);
    return this.substitute(template.content, template.variables, context);
  }

  async createVersion(templateId: string, content: string, changelog: string): Promise<string> {
    const template = await this.getTemplate(templateId);
    const version: PromptVersion = {
      version: this.nextVersion(template.version),
      content,
      createdAt: new Date().toISOString(),
      author: "system",
      changelog,
    };
    const versionId = await this.versioning.createVersion(this.resource, templateId, version);
    await this.updateTemplate(templateId, { content, version: version.version });
    return versionId;
  }

  async getTemplateVersions(templateId: string): Promise<PromptVersion[]> {
    return this.versioning.listVersions(this.resource, templateId);
  }

  async revertToVersion(templateId: string, versionId: string): Promise<void> {
    const versions = await this.getTemplateVersions(templateId);
    const target = versions.find(
      (v) => (v as unknown as { id?: string }).id === versionId || v.version === versionId,
    );
    if (!target) throw new Error("version_not_found");
    await this.versioning.revertToVersion(this.resource, templateId, versionId);
    await this.updateTemplate(templateId, { content: target.content, version: target.version });
  }

  async getTemplateSearch(category?: PromptCategory): Promise<PromptTemplate[]> {
    return this.getAllTemplates(category);
  }

  private substitute(content: string, variables: PromptVariable[], context: PromptContext): string {
    const valueFor = (name: string): unknown => {
      const paths = [
        ["codeContext", name],
        ["projectContext", name],
        ["userPreferences", name],
        ["history", name],
      ] as const;
      for (const [root, key] of paths) {
        const container = (context as Record<string, unknown>)[root];
        if (
          container &&
          typeof container === "object" &&
          key in (container as Record<string, unknown>)
        )
          return (container as Record<string, unknown>)[key];
      }
      return undefined;
    };
    let result = content;
    for (const v of variables) {
      const raw = valueFor(v.name);
      const val = raw === undefined || raw === null ? v.defaultValue : raw;
      if (v.required && (val === undefined || val === null || val === ""))
        throw new Error(`missing_variable:${v.name}`);
      const safe = val === undefined || val === null ? "" : String(val);
      const pattern = new RegExp(`\\{\\{\\s*${this.escapeRegex(v.name)}\\s*\\}\\}`, "g");
      result = result.replace(pattern, safe);
    }
    return result;
  }

  private validateTemplateObject(template: PromptTemplate): void {
    if (!template.id || !template.name || !template.version || !template.content)
      throw new Error("invalid_template");
    this.validateMetadata(template.metadata);
    this.validateVariables(template.variables);
  }

  private validateMetadata(metadata: PromptMetadata): void {
    if (!Object.values(PromptCategory).includes(metadata.category))
      throw new Error("invalid_category");
    if (!Object.values(PromptComplexity).includes(metadata.complexity))
      throw new Error("invalid_complexity");
    if (!metadata.language) throw new Error("invalid_language");
  }

  private validateVariables(variables: PromptVariable[]): void {
    if (!Array.isArray(variables)) throw new Error("invalid_variables");
    for (const v of variables) {
      if (!v.name || !v.type || typeof v.required !== "boolean")
        throw new Error("invalid_variable");
    }
  }

  private nextVersion(current: string): string {
    const parts = current.split(".").map((n) => Number(n));
    if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return "1.0.0";
    parts[parts.length - 1] += 1;
    return parts.join(".");
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
