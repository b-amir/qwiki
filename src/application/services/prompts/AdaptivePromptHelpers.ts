import type { ProjectContext } from "@/domain/entities/Selection";
import type {
  WikiOutline,
  WikiSection,
  DocumentationType,
} from "@/domain/entities/PromptEngineering";

export class AdaptivePromptHelpers {
  detectDocumentationType(content: string): DocumentationType {
    const apiPatterns = /api|endpoint|route|handler|controller/i;
    const componentPatterns = /component|ui|render|view|widget/i;
    const utilityPatterns = /util|helper|tool|utility|function/i;
    const servicePatterns = /service|manager|handler|processor/i;
    const configPatterns = /config|setting|option|parameter/i;

    if (apiPatterns.test(content)) return "api";
    if (componentPatterns.test(content)) return "component";
    if (utilityPatterns.test(content)) return "utility";
    if (servicePatterns.test(content)) return "service";
    if (configPatterns.test(content)) return "config";
    return "unknown";
  }

  generateTechStackInfo(context: ProjectContext): string {
    const parts: string[] = [];

    if (context.rootName) {
      parts.push(`Project: ${context.rootName}`);
    }

    if (context.overview) {
      parts.push(`Tech Stack: ${context.overview.substring(0, 200)}`);
    }

    return parts.join("\n");
  }

  createImprovementSuggestions(context: ProjectContext): string {
    const suggestions: string[] = [];

    if (!context.overview) {
      suggestions.push("Consider adding project overview for better context");
    }

    if (!context.related || context.related.length === 0) {
      suggestions.push("Consider documenting related files for better understanding");
    }

    return suggestions.length > 0
      ? `Suggestions:\n${suggestions.map((s) => `- ${s}`).join("\n")}`
      : "";
  }

  generateBestPracticesInfo(language: string, framework?: string): string {
    const practices: string[] = [];

    if (language === "typescript" || language === "javascript") {
      practices.push("Use JSDoc-style comments for complex functions");
      practices.push("Document exported functions and classes");
    }

    if (framework === "react") {
      practices.push("Document props and component usage");
      practices.push("Include examples with JSX");
    }

    return practices.length > 0
      ? `Best Practices:\n${practices.map((p) => `- ${p}`).join("\n")}`
      : "";
  }

  createSyntaxSection(language: string, complexity: number): string {
    if (complexity < 0.3) {
      return `Simple ${language} code. Focus on basic functionality and usage.`;
    }

    if (complexity > 0.7) {
      return `Complex ${language} code. Include detailed explanations of patterns, algorithms, and design decisions.`;
    }

    return `Moderate complexity ${language} code. Balance between simplicity and detail.`;
  }

  generateSummaryRequirements(context: ProjectContext): string {
    const hasContext = Boolean(context.overview || context.related?.length);
    return hasContext
      ? "Include project context in the summary when relevant."
      : "Keep summary concise and focused on the code snippet.";
  }

  createInDepthRequirements(context: ProjectContext): string {
    const requirements: string[] = ["Explain implementation details clearly"];

    if (context.related && context.related.length > 0) {
      requirements.push("Reference related files and components");
    }

    if (context.filesSample && context.filesSample.length > 5) {
      requirements.push("Consider project structure when explaining patterns");
    }

    return requirements.map((r) => `- ${r}`).join("\n");
  }
}
