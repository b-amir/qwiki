import { PromptTemplate } from "../types/PromptTypes";

export interface ProviderOptimization {
  type: string;
  description: string;
  impact: number;
}

export interface ProviderVariant {
  id: string;
  providerId: string;
  templateId: string;
  variantContent: string;
  optimizations: ProviderOptimization[];
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

export class ProviderPromptVariants {
  private readonly collection = "providerPromptVariants";

  constructor(
    private readonly storage: StorageService<ProviderVariant>,
    private readonly templates: TemplateResolver,
  ) {}

  async createVariant(providerId: string, templateId: string, content: string): Promise<string> {
    const id = await this.storage.create(this.collection, {
      id: "",
      providerId,
      templateId,
      variantContent: content,
      optimizations: [],
    });
    await this.storage.update(this.collection, id, { id });
    return id;
  }

  async getVariant(providerId: string, templateId: string): Promise<ProviderVariant | null> {
    const items = await this.storage.list(this.collection, { providerId, templateId });
    return items[0] ?? null;
  }

  async optimizeForProvider(templateId: string, providerId: string): Promise<string> {
    const variant = await this.getVariant(providerId, templateId);
    if (variant) return variant.variantContent;
    const template = await this.templates.getTemplate(templateId);
    return template.content;
  }

  async getAllVariants(templateId: string): Promise<ProviderVariant[]> {
    return this.storage.list(this.collection, { templateId });
  }

  async updateVariant(variantId: string, updates: Partial<ProviderVariant>): Promise<void> {
    await this.storage.update(this.collection, variantId, updates);
  }

  async deleteVariant(variantId: string): Promise<void> {
    await this.storage.delete(this.collection, variantId);
  }
}
