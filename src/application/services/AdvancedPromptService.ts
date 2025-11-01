import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { PromptQualityAnalyzer } from "./prompt/PromptQualityAnalyzer";
import type { GenerateParams } from "../../llm/types";
import type { ProjectContext } from "../../domain/entities/Selection";
import type {
  PromptTemplate,
  PromptSection,
  DynamicPromptConfig,
  ValidationResult,
  EffectivenessScore,
  TestCase,
} from "../../domain/entities/PromptEngineering";

export class AdvancedPromptService {
  private logger: Logger;
  private qualityAnalyzer: PromptQualityAnalyzer;

  constructor(
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("AdvancedPromptService", loggingService);
    this.qualityAnalyzer = new PromptQualityAnalyzer();
  }

  static buildWikiPrompt(params: GenerateParams): string {
    const { snippet, languageId, filePath } = params;

    const systemPrompt = `You are an expert technical documentation specialist. Your task is to create accurate, comprehensive documentation for code snippets. Follow these rules strictly:

1. ACCURACY FIRST: Only document what is explicitly visible in the code. Do not speculate about features not present.
2. CONSISTENT FORMAT: Use the exact section structure provided below.
3. CONTEXT-AWARE: Leverage the project context to provide relevant, specific information.
4. CONCISE YET COMPLETE: Be thorough but avoid unnecessary verbosity.
5. REAL EXAMPLES: Use actual code from the snippet when providing examples.`;

    const context = [
      languageId ? `Language: ${languageId}` : undefined,
      filePath ? `File: ${filePath}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");

    const proj = params.project;
    const projectSection = proj
      ? [
          `Project Context:`,
          proj.rootName ? `- Project Name: ${proj.rootName}` : undefined,
          proj.overview ? `- Project Overview: ${proj.overview}` : undefined,
          proj.filesSample && proj.filesSample.length
            ? `- Project Structure:\n${proj.filesSample.map((p) => `  - ${p}`).join("\n")}`
            : undefined,
          proj.related && proj.related.length
            ? `- Related Files & Usages:\n${proj.related
                .map(
                  (r) =>
                    `  - [${r.path}${r.line ? `:${r.line}` : ""}](openfile:${r.path}${r.line ? `:${r.line}` : ""})${r.reason ? ` - ${r.reason}` : ""}${
                      r.preview ? `\n    \`${r.preview.trim()}\`` : ""
                    }`,
                )
                .join("\n")}`
            : undefined,
        ]
          .filter(Boolean)
          .join("\n")
      : undefined;

    const strictInstructions = `OUTPUT REQUIREMENTS (NON-NEGOTIABLE):

Return ONLY raw Markdown content. No explanations, no commentary, no "Here is the documentation", just the markdown.

Start with a single H1 title. Extract the actual component/function/class name from the code:

# ComponentName - BriefPurpose

For example:
- # UserService - Handles user authentication
- # DataProcessor - Processes and validates input data
- # ButtonComponent - Renders clickable button UI
- # calculateTotal - Computes sum of values

If no clear name exists, use the filename or a descriptive name based on functionality.

Then create these EXACT sections in this order (use H2 headings exactly as shown):

## What It Is
## What It Does  
## How It Works
## Usage Examples
## Important Considerations
## Related Components

CONTENT GUIDELINES:
- What It Is: Brief technical definition based on actual code
- What It Does: Observable behavior and functionality only
- How It Works: Implementation details visible in the code
- Usage Examples: Real examples using the actual code patterns
- Important Considerations: Edge cases, limitations, requirements
- Related Components: References to files/components in project context

FORMATTING RULES:
- Use fenced code blocks with language identifiers: \`\`\`${languageId || "javascript"}\`
- Keep paragraphs under 3 sentences
- Use bullet points for lists
- Link to project files using: [filename](openfile:path) or [filename:line](openfile:path:line)
- No HTML tables, no complex formatting
- Do not invent functionality or features not present in the code`;

    const codeSection = [
      "CODE TO DOCUMENT:",
      "```" + (languageId || "") + "\n" + snippet + "\n```",
    ].join("\n");

    const finalPrompt = [systemPrompt, context, projectSection, strictInstructions, codeSection]
      .filter(Boolean)
      .join("\n\n");

    return finalPrompt;
  }

  async generateDynamicPrompt(config: DynamicPromptConfig): Promise<string> {
    const template = await this.selectOptimalTemplate(config.context);
    const customized = await this.customizePromptSections(template, config.context);
    const contextSection = this.buildContextSection(config.context);
    const instructionsSection = this.buildInstructionsSection(config);
    const outputSection = this.buildOutputFormatSection(config.language || "javascript");

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

  async validatePromptQuality(prompt: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!prompt || prompt.trim().length === 0) {
      errors.push("Prompt is empty");
    }

    if (prompt.length < 50) {
      warnings.push("Prompt is very short, may lack context");
    }

    if (prompt.length > 10000) {
      warnings.push("Prompt is very long, may exceed token limits");
    }

    if (!prompt.includes("documentation") && !prompt.includes("document")) {
      warnings.push("Prompt may not clearly specify documentation task");
    }

    if (!prompt.includes("```") && !prompt.includes("code")) {
      warnings.push("Prompt may not include code section");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async optimizePromptForProvider(prompt: string, provider: string): Promise<string> {
    let optimized = prompt;

    if (provider === "openrouter" || provider === "google-ai-studio") {
      optimized = optimized.replace(/NON-NEGOTIABLE/gi, "REQUIRED");
    }

    if (provider === "cohere") {
      optimized = optimized.replace(/```/g, "`");
    }

    return optimized;
  }

  async testPromptEffectiveness(
    prompt: string,
    testCases: TestCase[],
  ): Promise<EffectivenessScore> {
    return this.qualityAnalyzer.calculateEffectivenessScore(prompt);
  }

  private buildContextSection(context: ProjectContext): string {
    const parts: string[] = [];

    if (context.rootName) {
      parts.push(`Project Name: ${context.rootName}`);
    }

    if (context.overview) {
      parts.push(`Project Overview: ${context.overview}`);
    }

    if (context.filesSample && context.filesSample.length > 0) {
      parts.push(`Project Structure:\n${context.filesSample.map((p) => `  - ${p}`).join("\n")}`);
    }

    if (context.related && context.related.length > 0) {
      parts.push(
        `Related Files:\n${context.related
          .map(
            (r) =>
              `  - [${r.path}${r.line ? `:${r.line}` : ""}](openfile:${r.path}${r.line ? `:${r.line}` : ""})`,
          )
          .join("\n")}`,
      );
    }

    return parts.length > 0 ? parts.join("\n") : "";
  }

  private buildInstructionsSection(config: DynamicPromptConfig): string {
    const complexity = config.complexity || 0.5;
    let instructions = "OUTPUT REQUIREMENTS:\n\nReturn ONLY raw Markdown content.\n\n";

    if (complexity > 0.7) {
      instructions +=
        "Include detailed implementation analysis and edge cases.\nFocus on architectural patterns and design decisions.\n";
    } else if (complexity < 0.3) {
      instructions +=
        "Keep documentation simple and straightforward.\nFocus on basic functionality.\n";
    }

    instructions +=
      "Sections: What It Is, What It Does, How It Works, Usage Examples, Important Considerations, Related Components.";

    return instructions;
  }

  private buildOutputFormatSection(language: string): string {
    return `FORMATTING:
- Use fenced code blocks: \`\`\`${language}\`
- Keep paragraphs concise
- Use bullet points for lists
- Link files: [name](openfile:path)`;
  }

  private buildExamplesSection(context: ProjectContext): string {
    if (!context.related || context.related.length === 0) {
      return "";
    }

    const examples = context.related.slice(0, 3).map((r) => `- ${r.path}`);
    return `Example related files:\n${examples.join("\n")}`;
  }
}
