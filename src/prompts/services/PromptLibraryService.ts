import { PromptCategory, PromptTemplate } from "../types/PromptTypes";

export type ExportFormat = "json";

export interface LibraryMetadata {
  createdAt: string;
  updatedAt: string;
  author?: string;
  description?: string;
}

export interface PromptLibrary {
  id: string;
  name: string;
  templates: string[];
  categories?: PromptCategory[];
  metadata: LibraryMetadata;
}

interface StorageService<T> {
  create(collection: string, item: T): Promise<string>;
  update(collection: string, id: string, updates: Partial<T>): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  get(collection: string, id: string): Promise<T>;
  list(collection: string, filter?: Record<string, unknown>): Promise<T[]>;
}

interface TemplateResolver {
  getTemplate(templateId: string): Promise<PromptTemplate>;
}

export class PromptLibraryService {
  private readonly collection = "promptLibraries";

  constructor(
    private readonly storage: StorageService<PromptLibrary>,
    private readonly templates: TemplateResolver,
  ) {}

  async createLibrary(library: PromptLibrary): Promise<string> {
    const id = await this.storage.create(this.collection, library);
    await this.storage.update(this.collection, id, {
      id,
      metadata: {
        ...library.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    return id;
  }

  async addTemplateToLibrary(libraryId: string, templateId: string): Promise<void> {
    const lib = await this.storage.get(this.collection, libraryId);
    if (!lib.templates.includes(templateId)) lib.templates.push(templateId);
    await this.storage.update(this.collection, libraryId, {
      templates: lib.templates,
      metadata: { ...lib.metadata, updatedAt: new Date().toISOString() },
    });
  }

  async removeTemplateFromLibrary(libraryId: string, templateId: string): Promise<void> {
    const lib = await this.storage.get(this.collection, libraryId);
    const next = lib.templates.filter((t) => t !== templateId);
    await this.storage.update(this.collection, libraryId, {
      templates: next,
      metadata: { ...lib.metadata, updatedAt: new Date().toISOString() },
    });
  }

  async getLibraryTemplates(
    libraryId: string,
    category?: PromptCategory,
  ): Promise<PromptTemplate[]> {
    const lib = await this.storage.get(this.collection, libraryId);
    const templates = await Promise.all(lib.templates.map((id) => this.templates.getTemplate(id)));
    return category ? templates.filter((t) => t.metadata.category === category) : templates;
  }

  async searchLibrary(libraryId: string, query: string): Promise<PromptTemplate[]> {
    const text = query.trim().toLowerCase();
    const items = await this.getLibraryTemplates(libraryId);
    return items.filter(
      (t) =>
        t.name.toLowerCase().includes(text) ||
        t.content.toLowerCase().includes(text) ||
        (t.metadata.provider || "").toLowerCase().includes(text),
    );
  }

  async exportLibrary(libraryId: string, format: ExportFormat = "json"): Promise<ArrayBuffer> {
    if (format !== "json") throw new Error("unsupported_format");
    const lib = await this.storage.get(this.collection, libraryId);
    const templates = await this.getLibraryTemplates(libraryId);
    const payload = { library: lib, templates };
    const json = JSON.stringify(payload);
    return new TextEncoder().encode(json).buffer;
  }

  async importLibrary(data: ArrayBuffer, format: ExportFormat = "json"): Promise<string> {
    if (format !== "json") throw new Error("unsupported_format");
    const json = new TextDecoder().decode(new Uint8Array(data));
    const parsed = JSON.parse(json) as { library: PromptLibrary; templates: PromptTemplate[] };
    const lib = parsed.library;
    const id = await this.createLibrary({ ...lib, id: "" });
    const templateIds: string[] = [];
    for (const t of parsed.templates) templateIds.push(t.id);
    await this.storage.update(this.collection, id, { templates: templateIds });
    return id;
  }
}
