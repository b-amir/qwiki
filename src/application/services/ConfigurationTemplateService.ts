import type {
  ConfigurationTemplate,
  TemplateMetadata,
  ProviderConfiguration,
  GlobalConfiguration,
  ProviderConfigurationMap,
} from "../../domain/configuration";
import type { ConfigurationRepository } from "../../domain/repositories/ConfigurationRepository";
import { EventBus } from "../../events";

export class ConfigurationTemplateService {
  private templates = new Map<string, ConfigurationTemplate>();
  private readonly TEMPLATE_KEY_PREFIX = "qwiki.template.";

  constructor(
    private configurationRepository: ConfigurationRepository,
    private eventBus: EventBus,
  ) {
    this.initializeBuiltinTemplates();
  }

  getAvailableTemplates(): ConfigurationTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(id: string): ConfigurationTemplate | null {
    return this.templates.get(id) || null;
  }

  async applyTemplate(templateId: string): Promise<void> {
    const template = this.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template with id '${templateId}' not found`);
    }

    await this.eventBus.publish("templateApplying", { templateId, template });

    try {
      await this.configurationRepository.set("global", template.configuration.global);

      for (const [providerId, providerConfig] of Object.entries(template.configuration.providers)) {
        await this.configurationRepository.set(`provider.${providerId}`, providerConfig);
      }

      await this.eventBus.publish("templateApplied", { templateId, template });
    } catch (error) {
      await this.eventBus.publish("templateApplyFailed", {
        templateId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  createTemplate(config: any, metadata: TemplateMetadata): ConfigurationTemplate {
    const templateId = this.generateTemplateId(metadata.name);

    const template: ConfigurationTemplate = {
      id: templateId,
      name: metadata.name,
      description: metadata.description,
      category: metadata.category as any,
      configuration: {
        global: config.global || this.getDefaultGlobalConfig(),
        providers: config.providers || {},
      },
      metadata: {
        author: metadata.author,
        version: "1.0.0",
        tags: metadata.tags,
        compatibleProviders: Object.keys(config.providers || {}),
      },
    };

    return template;
  }

  async saveTemplate(template: ConfigurationTemplate): Promise<void> {
    this.templates.set(template.id, template);

    const key = `${this.TEMPLATE_KEY_PREFIX}${template.id}`;
    await this.configurationRepository.set(key, template);

    await this.eventBus.publish("templateSaved", { templateId: template.id, template });
  }

  async deleteTemplate(templateId: string): Promise<void> {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template with id '${templateId}' not found`);
    }

    this.templates.delete(templateId);

    const key = `${this.TEMPLATE_KEY_PREFIX}${templateId}`;
    await this.configurationRepository.set(key, undefined as any);

    await this.eventBus.publish("templateDeleted", { templateId });
  }

  async loadCustomTemplates(): Promise<void> {
    const allConfigs = await this.configurationRepository.getAll();

    for (const [key, value] of Object.entries(allConfigs)) {
      if (key.startsWith(this.TEMPLATE_KEY_PREFIX) && value) {
        const template = value as ConfigurationTemplate;
        this.templates.set(template.id, template);
      }
    }
  }

  async exportTemplate(templateId: string): Promise<string> {
    const template = this.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template with id '${templateId}' not found`);
    }

    return JSON.stringify(template, null, 2);
  }

  async importTemplate(templateJson: string): Promise<ConfigurationTemplate> {
    try {
      const template = JSON.parse(templateJson) as ConfigurationTemplate;

      if (!this.validateTemplate(template)) {
        throw new Error("Invalid template structure");
      }

      this.templates.set(template.id, template);
      await this.saveTemplate(template);

      await this.eventBus.publish("templateImported", { templateId: template.id, template });

      return template;
    } catch (error) {
      await this.eventBus.publish("templateImportFailed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to import template: ${error}`);
    }
  }

  private generateTemplateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private getDefaultGlobalConfig(): GlobalConfiguration {
    return {
      defaultProviderId: undefined,
      autoGenerateWiki: false,
      wikiOutputFormat: "markdown",
      maxContextLength: 10000,
      enableCaching: true,
      cacheExpirationHours: 24,
      enablePerformanceMonitoring: true,
      enableErrorReporting: true,
      logLevel: "error",
      uiTheme: "auto",
      language: "en",
      autoSave: true,
      backupEnabled: true,
      backupRetentionDays: 30,
    };
  }

  private validateTemplate(template: any): boolean {
    if (!template || typeof template !== "object") {
      return false;
    }

    const requiredFields = ["id", "name", "description", "category", "configuration", "metadata"];
    for (const field of requiredFields) {
      if (!(field in template)) {
        return false;
      }
    }

    if (!template.configuration || typeof template.configuration !== "object") {
      return false;
    }

    if (!template.configuration.global || typeof template.configuration.global !== "object") {
      return false;
    }

    if (!template.configuration.providers || typeof template.configuration.providers !== "object") {
      return false;
    }

    if (!template.metadata || typeof template.metadata !== "object") {
      return false;
    }

    const requiredMetadataFields = ["author", "version", "tags", "compatibleProviders"];
    for (const field of requiredMetadataFields) {
      if (!(field in template.metadata)) {
        return false;
      }
    }

    return true;
  }

  private initializeBuiltinTemplates(): void {
    const developmentTemplate: ConfigurationTemplate = {
      id: "development-setup",
      name: "Development Setup",
      description: "Optimized configuration for development environments with debugging enabled",
      category: "development",
      configuration: {
        global: {
          ...this.getDefaultGlobalConfig(),
          logLevel: "debug",
          enablePerformanceMonitoring: true,
          enableErrorReporting: true,
          autoGenerateWiki: true,
          wikiOutputFormat: "markdown",
        },
        providers: {
          openai: {
            id: "openai",
            name: "OpenAI",
            enabled: true,
            model: "gpt-4",
            temperature: 0.3,
            maxTokens: 2000,
            timeout: 30000,
            retryAttempts: 3,
          },
        },
      },
      metadata: {
        author: "Qwiki Team",
        version: "1.0.0",
        tags: ["development", "debugging", "openai"],
        compatibleProviders: ["openai"],
      },
    };

    const productionTemplate: ConfigurationTemplate = {
      id: "production-setup",
      name: "Production Setup",
      description: "Optimized configuration for production environments with reliability focus",
      category: "production",
      configuration: {
        global: {
          ...this.getDefaultGlobalConfig(),
          logLevel: "error",
          enablePerformanceMonitoring: true,
          enableErrorReporting: false,
          autoGenerateWiki: false,
          wikiOutputFormat: "markdown",
          backupEnabled: true,
          backupRetentionDays: 90,
        },
        providers: {
          openai: {
            id: "openai",
            name: "OpenAI",
            enabled: true,
            model: "gpt-4-turbo",
            temperature: 0.1,
            maxTokens: 4000,
            timeout: 60000,
            retryAttempts: 5,
            fallbackProviderIds: ["anthropic"],
          },
          anthropic: {
            id: "anthropic",
            name: "Anthropic",
            enabled: true,
            model: "claude-3-sonnet-20240229",
            temperature: 0.1,
            maxTokens: 4000,
            timeout: 60000,
            retryAttempts: 5,
          },
        },
      },
      metadata: {
        author: "Qwiki Team",
        version: "1.0.0",
        tags: ["production", "reliability", "multi-provider"],
        compatibleProviders: ["openai", "anthropic"],
      },
    };

    const enterpriseTemplate: ConfigurationTemplate = {
      id: "enterprise-setup",
      name: "Enterprise Setup",
      description: "Enterprise-grade configuration with security and compliance features",
      category: "enterprise",
      configuration: {
        global: {
          ...this.getDefaultGlobalConfig(),
          logLevel: "warn",
          enablePerformanceMonitoring: true,
          enableErrorReporting: false,
          autoGenerateWiki: false,
          wikiOutputFormat: "markdown",
          backupEnabled: true,
          backupRetentionDays: 365,
          enableCaching: true,
          cacheExpirationHours: 48,
        },
        providers: {
          openai: {
            id: "openai",
            name: "OpenAI",
            enabled: true,
            model: "gpt-4-turbo",
            temperature: 0.0,
            maxTokens: 8000,
            timeout: 120000,
            retryAttempts: 3,
            rateLimitPerMinute: 60,
            fallbackProviderIds: ["anthropic"],
          },
          anthropic: {
            id: "anthropic",
            name: "Anthropic",
            enabled: true,
            model: "claude-3-opus-20240229",
            temperature: 0.0,
            maxTokens: 8000,
            timeout: 120000,
            retryAttempts: 3,
            rateLimitPerMinute: 50,
          },
        },
      },
      metadata: {
        author: "Qwiki Team",
        version: "1.0.0",
        tags: ["enterprise", "security", "compliance", "multi-provider"],
        compatibleProviders: ["openai", "anthropic"],
      },
    };

    const minimalTemplate: ConfigurationTemplate = {
      id: "minimal-setup",
      name: "Minimal Setup",
      description: "Lightweight configuration for quick start with basic features",
      category: "development",
      configuration: {
        global: {
          ...this.getDefaultGlobalConfig(),
          logLevel: "error",
          enablePerformanceMonitoring: false,
          enableErrorReporting: false,
          autoGenerateWiki: false,
          wikiOutputFormat: "markdown",
          backupEnabled: false,
          enableCaching: false,
        },
        providers: {
          openai: {
            id: "openai",
            name: "OpenAI",
            enabled: true,
            model: "gpt-3.5-turbo",
            temperature: 0.7,
            maxTokens: 1000,
            timeout: 30000,
            retryAttempts: 1,
          },
        },
      },
      metadata: {
        author: "Qwiki Team",
        version: "1.0.0",
        tags: ["minimal", "quick-start", "basic"],
        compatibleProviders: ["openai"],
      },
    };

    this.templates.set(developmentTemplate.id, developmentTemplate);
    this.templates.set(productionTemplate.id, productionTemplate);
    this.templates.set(enterpriseTemplate.id, enterpriseTemplate);
    this.templates.set(minimalTemplate.id, minimalTemplate);
  }
}
