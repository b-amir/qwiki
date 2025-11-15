import type { ProjectContext } from "@/domain/entities/Selection";
import type { WikiOutline, WikiSection } from "@/domain/entities/PromptEngineering";

export class PromptOutlineGenerator {
  async determineOptimalOutline(context: ProjectContext): Promise<WikiOutline> {
    const hasRelated = context.related && context.related.length > 0;
    const hasOverview = Boolean(context.overview?.trim());

    const sections: WikiSection[] = [
      { name: "What It Is", required: true, priority: 10 },
      { name: "What It Does", required: true, priority: 9 },
      { name: "How It Works", required: true, priority: 8 },
      { name: "Usage Examples", required: true, priority: 7 },
      { name: "Important Considerations", required: false, priority: 6 },
    ];

    if (hasRelated) {
      sections.push({ name: "Related Components", required: false, priority: 5 });
    }

    if (hasOverview) {
      sections.push({ name: "Project Integration", required: false, priority: 4 });
    }

    return {
      sections,
      priority: hasRelated && hasOverview ? 10 : hasRelated || hasOverview ? 7 : 5,
    };
  }

  async filterIrrelevantSections(
    outline: WikiOutline,
    context: ProjectContext,
  ): Promise<WikiOutline> {
    const hasRelated = context.related && context.related.length > 0;
    const hasOverview = Boolean(context.overview?.trim());

    const filtered: WikiSection[] = outline.sections.filter((section) => {
      if (section.required) return true;
      if (section.name === "Related Components" && !hasRelated) return false;
      if (section.name === "Project Integration" && !hasOverview) return false;
      return true;
    });

    return {
      sections: filtered,
      priority: outline.priority,
    };
  }

  async generateContextualInstructions(context: ProjectContext): Promise<string> {
    const parts: string[] = [];

    if (context.overview) {
      parts.push(`Project Context: ${context.overview}`);
    }

    if (context.related && context.related.length > 0) {
      parts.push(`Include references to ${context.related.length} related file(s) when relevant.`);
    }

    if (context.filesSample && context.filesSample.length > 0) {
      parts.push(
        `Project structure includes ${context.filesSample.length} file(s). Use this to understand project organization.`,
      );
    }

    return parts.length > 0 ? parts.join("\n") : "";
  }
}
