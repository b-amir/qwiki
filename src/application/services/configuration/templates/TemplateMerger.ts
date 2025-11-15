import type { ConfigurationTemplate } from "@/domain/configuration";

export class TemplateMerger {
  mergeTemplate(
    target: ConfigurationTemplate,
    parent: ConfigurationTemplate,
    overrides: Partial<ConfigurationTemplate>,
  ): void {
    this.deepMerge(target.configuration.global, parent.configuration.global);
    this.deepMerge(target.configuration.providers, parent.configuration.providers);
    this.deepMerge(target, overrides);
  }

  composeTemplates(
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
}
