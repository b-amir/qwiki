import type { GenerateParams } from "@/llm/types";
import type { ProjectTypeDetection } from "@/domain/entities/ContextIntelligence";
import {
  openrouterPromptTemplate,
  zaiPromptTemplate,
  googlePromptTemplate,
  coherePromptTemplate,
  huggingfacePromptTemplate,
  defaultPromptTemplate,
  type PromptTemplate,
} from "@/application/services/prompts/templates";

export class EnhancedPromptBuilder {
  private getPromptTemplate(providerId?: string): PromptTemplate {
    if (!providerId) {
      return defaultPromptTemplate;
    }

    const providerIdLower = providerId.toLowerCase();
    if (providerIdLower === "openrouter") {
      return openrouterPromptTemplate;
    }
    if (providerIdLower === "zai") {
      return zaiPromptTemplate;
    }
    if (providerIdLower === "google-ai-studio" || providerIdLower.includes("google")) {
      return googlePromptTemplate;
    }
    if (providerIdLower === "cohere") {
      return coherePromptTemplate;
    }
    if (providerIdLower === "huggingface") {
      return huggingfacePromptTemplate;
    }

    return defaultPromptTemplate;
  }

  buildWikiPrompt(
    params: GenerateParams,
    providerId?: string,
    projectType?: ProjectTypeDetection,
    examples?: string[],
  ): string {
    const template = this.getPromptTemplate(providerId);
    const contextAwarePrompt = this.buildContextAwarePrompt(
      params,
      template,
      projectType,
      examples,
    );

    return contextAwarePrompt;
  }

  private buildContextAwarePrompt(
    params: GenerateParams,
    template: PromptTemplate,
    projectType?: ProjectTypeDetection,
    examples?: string[],
  ): string {
    const { snippet, languageId, filePath, semanticInfo, project } = params;

    let context = this.buildProjectContext(project, projectType);
    const complexity = this.analyzeComplexity(snippet);

    let userPrompt = template.buildUserPrompt(params, context, examples);

    if (projectType) {
      userPrompt = this.addProjectTypeGuidance(userPrompt, projectType, languageId);
    }

    if (complexity !== "medium") {
      userPrompt = this.addComplexityGuidance(userPrompt, complexity);
    }

    return `${template.system}\n\n${userPrompt}`;
  }

  private buildProjectContext(
    project?: GenerateParams["project"],
    projectType?: ProjectTypeDetection,
  ): string {
    if (!project) {
      return "";
    }

    const parts: string[] = [];
    if (project.rootName) {
      parts.push(`Project: ${project.rootName}`);
    }
    if (project.overview) {
      parts.push(`Overview: ${project.overview}`);
    }
    if (project.filesSample && project.filesSample.length > 0) {
      parts.push(`Files: ${project.filesSample.slice(0, 5).join(", ")}`);
    }
    if (project.related && project.related.length > 0) {
      parts.push(
        `Related: ${project.related
          .slice(0, 3)
          .map((r) => r.path)
          .join(", ")}`,
      );
    }
    if (projectType) {
      if (projectType.framework) {
        parts.push(`Framework: ${projectType.framework}`);
      }
      if (projectType.primaryLanguage) {
        parts.push(`Language: ${projectType.primaryLanguage}`);
      }
    }

    return parts.join("\n");
  }

  private addProjectTypeGuidance(
    prompt: string,
    projectType: ProjectTypeDetection,
    languageId?: string,
  ): string {
    let guidance = "";

    if (projectType.framework === "vue") {
      guidance +=
        "\n\nNote: This is a Vue.js project. Focus on component lifecycle, reactivity, and Vue-specific patterns.";
    } else if (projectType.framework === "react") {
      guidance +=
        "\n\nNote: This is a React project. Focus on hooks, component composition, and React-specific patterns.";
    } else if (projectType.framework === "angular") {
      guidance +=
        "\n\nNote: This is an Angular project. Focus on dependency injection, decorators, and Angular-specific patterns.";
    } else if (projectType.framework === "express" || projectType.framework === "nextjs") {
      guidance +=
        "\n\nNote: This is a Node.js/Express project. Focus on request handling, middleware, and server-side patterns.";
    } else if (projectType.framework === "django" || projectType.framework === "flask") {
      guidance +=
        "\n\nNote: This is a Python web project. Focus on request handling, views, and Python web patterns.";
    }

    if (languageId === "typescript" && projectType.primaryLanguage === "typescript") {
      guidance +=
        "\n\nNote: This is TypeScript code. Emphasize type safety, interfaces, and TypeScript-specific features.";
    }

    return prompt + guidance;
  }

  private analyzeComplexity(snippet: string): "low" | "medium" | "high" {
    const lines = snippet.split("\n").length;
    const functions = (snippet.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
    const classes = (snippet.match(/class\s+\w+/g) || []).length;
    const asyncPatterns = (snippet.match(/async\s+|await\s+/g) || []).length;
    const complexity = lines + functions * 10 + classes * 20 + asyncPatterns * 5;

    if (complexity < 50) return "low";
    if (complexity < 150) return "medium";
    return "high";
  }

  private addComplexityGuidance(prompt: string, complexity: "low" | "medium" | "high"): string {
    if (complexity === "high") {
      return (
        prompt + "\n\nThis code is complex. Provide detailed explanations and consider edge cases."
      );
    } else if (complexity === "low") {
      return prompt + "\n\nThis code is straightforward. Keep documentation concise and focused.";
    }
    return prompt;
  }
}
