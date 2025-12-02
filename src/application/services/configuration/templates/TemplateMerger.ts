import type { ConfigurationTemplate } from "@/domain/configuration";

export class TemplateMerger {
  mergeTemplate(
    target: ConfigurationTemplate,
    parent: ConfigurationTemplate,
    overrides: Partial<ConfigurationTemplate>,
  ): void {
    this.deepMerge(
      target.configuration.global as Record<string, unknown>,
      parent.configuration.global as Record<string, unknown>,
    );
    this.deepMerge(
      target.configuration.providers as Record<string, unknown>,
      parent.configuration.providers as Record<string, unknown>,
    );
    this.deepMerge(
      target as unknown as Record<string, unknown>,
      overrides as Record<string, unknown>,
    );
  }

  composeTemplates(
    target: ConfigurationTemplate,
    templates: ConfigurationTemplate[],
    strategy: "deep" | "shallow" | "replace",
  ): void {
    for (const template of templates) {
      if (strategy === "deep") {
        this.deepMerge(
          target.configuration.global as Record<string, unknown>,
          template.configuration.global as Record<string, unknown>,
        );
        this.deepMerge(
          target.configuration.providers as Record<string, unknown>,
          template.configuration.providers as Record<string, unknown>,
        );
      } else if (strategy === "shallow") {
        Object.assign(target.configuration.global, template.configuration.global);
        Object.assign(target.configuration.providers, template.configuration.providers);
      } else if (strategy === "replace") {
        target.configuration.global = { ...template.configuration.global };
        target.configuration.providers = { ...template.configuration.providers };
      }
    }
  }

  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>,
        );
      } else {
        target[key] = source[key];
      }
    }
  }
}
