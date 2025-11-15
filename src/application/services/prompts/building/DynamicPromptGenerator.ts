import { PromptSectionBuilder } from "@/application/services/prompts/PromptSectionBuilder";
import type { ProjectContext } from "@/domain/entities/Selection";
import type {
  PromptTemplate,
  PromptSection,
  DynamicPromptConfig,
} from "@/domain/entities/PromptEngineering";

export class DynamicPromptGenerator {
  constructor(private sectionBuilder: PromptSectionBuilder) {}

  async generateDynamicPrompt(config: DynamicPromptConfig): Promise<string> {
    const template = await this.selectOptimalTemplate(config.context);
    const customized = await this.customizePromptSections(template, config.context);
    const contextSection = this.sectionBuilder.buildContextSection(config.context);
    const instructionsSection = this.sectionBuilder.buildInstructionsSection(config);
    const outputSection = this.sectionBuilder.buildOutputFormatSection(
      config.language || "javascript",
    );

    const sections: string[] = [];

    for (const section of customized.sections.sort((a, b) => b.priority - a.priority)) {
      if (!section.conditional || section.conditional(config.context)) {
        sections.push(section.content);
      }
    }

    sections.push(contextSection, instructionsSection, outputSection);

    return sections.filter(Boolean).join("\n\n");
  }

  async selectOptimalTemplate(context: ProjectContext): Promise<PromptTemplate> {
    const hasRelated = context.related && context.related.length > 0;
    const hasOverview = Boolean(context.overview?.trim());

    const baseSections: PromptSection[] = [
      {
        name: "system",
        content: `You are an expert technical documentation specialist. Your task is to create accurate, comprehensive documentation for code snippets.`,
        priority: 10,
      },
      {
        name: "instructions",
        content: `Follow these rules strictly:\n1. ACCURACY FIRST: Only document what is explicitly visible.\n2. CONSISTENT FORMAT: Use the exact section structure.\n3. CONTEXT-AWARE: Leverage project context.\n4. CONCISE YET COMPLETE: Be thorough but avoid verbosity.`,
        priority: 9,
      },
    ];

    if (hasRelated) {
      baseSections.push({
        name: "related",
        content: "Include references to related components in the project.",
        priority: 7,
        conditional: () => hasRelated,
      });
    }

    if (hasOverview) {
      baseSections.push({
        name: "context",
        content: "Use project overview to provide relevant context.",
        priority: 6,
        conditional: () => hasOverview,
      });
    }

    return {
      id: "default",
      name: "Standard Wiki Template",
      sections: baseSections,
      variables: [],
      metadata: {
        version: "1.0.0",
        complexity: "moderate",
      },
    };
  }

  async customizePromptSections(
    template: PromptTemplate,
    context: ProjectContext,
  ): Promise<PromptTemplate> {
    const customizedSections = template.sections
      .map((section) => {
        if (section.conditional && !section.conditional(context)) {
          return null;
        }
        return section;
      })
      .filter((s): s is PromptSection => s !== null);

    return {
      ...template,
      sections: customizedSections,
    };
  }
}
