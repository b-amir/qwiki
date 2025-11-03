import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { PromptQualityAnalyzer } from "./prompt/PromptQualityAnalyzer";
import { AdaptivePromptHelpers } from "./prompt/AdaptivePromptHelpers";
import { PromptSectionBuilder } from "./prompt/PromptSectionBuilder";
import { ContextAnalysisService } from "./ContextAnalysisService";
import type { GenerateParams } from "../../llm/types";
import type { ProjectContext } from "../../domain/entities/Selection";
import type {
  PromptTemplate,
  PromptSection,
  DynamicPromptConfig,
  ValidationResult,
  EffectivenessScore,
  TestCase,
  ComplexityAnalysis,
  WikiOutline,
  WikiSection,
  ProviderVariants,
  DocumentationType,
} from "../../domain/entities/PromptEngineering";

export class AdvancedPromptService {
  private logger: Logger;
  private qualityAnalyzer: PromptQualityAnalyzer;
  private adaptiveHelpers: AdaptivePromptHelpers;
  private sectionBuilder: PromptSectionBuilder;

  constructor(
    private loggingService: LoggingService,
    private contextAnalysisService?: ContextAnalysisService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("AdvancedPromptService", loggingService);
    this.qualityAnalyzer = new PromptQualityAnalyzer();
    this.adaptiveHelpers = new AdaptivePromptHelpers();
    this.sectionBuilder = new PromptSectionBuilder();
  }

  static buildWikiPrompt(params: GenerateParams): string {
    const { snippet, languageId, filePath, semanticInfo } = params;

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

    const semanticSection = semanticInfo
      ? [
          `Code Semantic Information:`,
          `- Symbol Name: ${semanticInfo.symbolName}`,
          `- Symbol Kind: ${this.getSymbolKindName(semanticInfo.symbolKind)}`,
          semanticInfo.type ? `- Type: ${semanticInfo.type}` : undefined,
          semanticInfo.isAsync ? `- Execution: Async function (returns Promise)` : undefined,
          semanticInfo.returnType ? `- Return Type: ${semanticInfo.returnType}` : undefined,
          semanticInfo.parameters && semanticInfo.parameters.length > 0
            ? `- Parameters:\n${semanticInfo.parameters.map((p) => `  - ${p.name}${p.type ? `: ${p.type}` : ""}`).join("\n")}`
            : undefined,
          semanticInfo.documentation ? `- Documentation: ${semanticInfo.documentation}` : undefined,
        ]
          .filter(Boolean)
          .join("\n")
      : undefined;

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

    const finalPrompt = [
      systemPrompt,
      context,
      semanticSection,
      projectSection,
      strictInstructions,
      codeSection,
    ]
      .filter(Boolean)
      .join("\n\n");

    return finalPrompt;
  }

  private static getSymbolKindName(kind: number): string {
    const kindMap: Record<number, string> = {
      1: "File",
      2: "Module",
      3: "Namespace",
      4: "Package",
      5: "Class",
      6: "Method",
      7: "Property",
      8: "Field",
      9: "Constructor",
      10: "Enum",
      11: "Interface",
      12: "Function",
      13: "Variable",
      14: "Constant",
      15: "String",
      16: "Number",
      17: "Boolean",
      18: "Array",
      19: "Object",
      20: "Key",
      21: "Null",
      22: "EnumMember",
      23: "Struct",
      24: "Event",
      25: "Operator",
      26: "TypeParameter",
    };
    return kindMap[kind] || "Unknown";
  }

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

  async analyzeCodeComplexity(content: string): Promise<ComplexityAnalysis> {
    const lines = content.split("\n");
    const functionMatches = content.match(/(?:function|const|let|var|async)\s+\w+\s*[=(]/g) || [];
    const classMatches = content.match(/class\s+\w+/g) || [];
    const interfaceMatches = content.match(/interface\s+\w+/g) || [];
    const nestingDepth = this.calculateSimpleNesting(content);

    const functions = functionMatches.length;
    const classes = classMatches.length;
    const interfaces = interfaceMatches.length;

    const overall = Math.min(
      1.0,
      functions * 0.1 + classes * 0.2 + interfaces * 0.15 + nestingDepth * 0.1,
    );

    return {
      overall,
      cyclomatic: functions + nestingDepth,
      cognitive: nestingDepth * 0.5,
      functions,
      classes,
      interfaces,
      lines: lines.length,
    };
  }

  private calculateSimpleNesting(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of content) {
      if (char === "{") {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === "}") {
        currentDepth--;
      }
    }

    return maxDepth;
  }

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

  async createProviderSpecificVariants(basePrompt: string): Promise<ProviderVariants> {
    const variants: ProviderVariants = {
      default: basePrompt,
    };

    variants.openrouter = basePrompt.replace(/NON-NEGOTIABLE/gi, "REQUIRED");
    variants["google-ai-studio"] = basePrompt.replace(/NON-NEGOTIABLE/gi, "REQUIRED");
    variants.cohere = basePrompt.replace(/```/g, "`");
    variants.huggingface = basePrompt.replace(/OUTPUT REQUIREMENTS/i, "Generate documentation");
    variants.zai = basePrompt;

    return variants;
  }

  async adaptPromptToLanguage(prompt: string, language: string): Promise<string> {
    let adapted = prompt;

    const languagePatterns: Record<string, { terms: string[]; conventions: string }> = {
      typescript: {
        terms: ["TypeScript", "type definitions", "interfaces", "generics"],
        conventions: "Use TypeScript-specific terminology. Mention types and interfaces.",
      },
      javascript: {
        terms: ["JavaScript", "functions", "objects", "prototypes"],
        conventions: "Use JavaScript conventions. Focus on functions and object patterns.",
      },
      python: {
        terms: ["Python", "functions", "classes", "modules", "decorators"],
        conventions: "Use Python conventions. Mention modules and decorators where relevant.",
      },
      java: {
        terms: ["Java", "classes", "methods", "packages", "interfaces"],
        conventions: "Use Java conventions. Focus on classes and packages.",
      },
    };

    const langInfo = languagePatterns[language.toLowerCase()];
    if (langInfo) {
      adapted = `${adapted}\n\nLanguage-specific guidance: ${langInfo.conventions}`;
    }

    return adapted;
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

  private detectDocumentationType(content: string): DocumentationType {
    return this.adaptiveHelpers.detectDocumentationType(content);
  }

  private generateTechStackInfo(context: ProjectContext): string {
    return this.adaptiveHelpers.generateTechStackInfo(context);
  }

  private createImprovementSuggestions(context: ProjectContext): string {
    return this.adaptiveHelpers.createImprovementSuggestions(context);
  }

  private generateBestPracticesInfo(language: string, framework?: string): string {
    return this.adaptiveHelpers.generateBestPracticesInfo(language, framework);
  }

  private createSyntaxSection(language: string, complexity: number): string {
    return this.adaptiveHelpers.createSyntaxSection(language, complexity);
  }

  private generateSummaryRequirements(context: ProjectContext): string {
    return this.adaptiveHelpers.generateSummaryRequirements(context);
  }

  private createInDepthRequirements(context: ProjectContext): string {
    return this.adaptiveHelpers.createInDepthRequirements(context);
  }
}
