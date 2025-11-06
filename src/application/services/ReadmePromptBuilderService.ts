import type { SavedWiki } from "./WikiStorageService";
import { ReadmeState } from "./ReadmeStateDetectionService";
import { WikiSummarizationService } from "./WikiSummarizationService";
import { ProjectContextService } from "./ProjectContextService";
import { ProjectTypeDetectionService } from "./context/ProjectTypeDetectionService";
import { ReadmePromptTemplates } from "./ReadmePromptTemplates";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class ReadmePromptBuilderService {
  private logger: Logger;

  constructor(
    private wikiSummarizationService: WikiSummarizationService,
    private projectContextService: ProjectContextService,
    private projectTypeDetectionService: ProjectTypeDetectionService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmePromptBuilderService");
  }

  async buildPrompt(
    currentReadme: string,
    includedWikis: SavedWiki[],
    excludedWikis: SavedWiki[],
    isBoilerplate: boolean,
    state: ReadmeState = ReadmeState.BOILERPLATE,
  ): Promise<string> {
    this.logger.debug("Building README prompt with project context", {
      wikiCount: includedWikis.length,
      state,
    });

    const projectContext = await this.buildProjectContext();
    const projectType = await this.projectTypeDetectionService.detectProjectType();

    const systemPrompt = `You are an expert technical documentation specialist. Your task is to create or update a project README.md file that provides a comprehensive overview of the entire project, while incorporating documentation from saved wiki entries.

CRITICAL RULES:
1. Return ONLY raw Markdown content - no explanations, no commentary, no meta-commentary
2. Create a README that represents the ENTIRE project, not just the documented components
3. The saved wikis document specific parts/components - use them to enhance sections, not dominate the README
4. Provide an overall project structure, purpose, and architecture
5. Maintain professional documentation standards following industry best practices
6. Use clear section headings and consistent formatting throughout
7. Preserve code examples from the wikis exactly as they appear
8. Create logical flow and organization with proper section ordering
9. Write in plain, accessible language that is clear to both beginners and experts
10. Use consistent terminology and naming conventions throughout`;

    const currentReadmeSection = currentReadme
      ? `CURRENT README CONTENT:
\`\`\`markdown
${currentReadme}
\`\`\``
      : "";

    const projectOverviewSection = this.buildProjectOverviewSection(projectContext, projectType);

    const instructions = this.getInstructionsForState(state, isBoilerplate);

    const wikisSection = `SAVED WIKI DOCUMENTATION (to incorporate into relevant sections):
${includedWikis
  .map(
    (wiki, index) => `## Wiki ${index + 1}: ${wiki.title}
${wiki.content}
---
`,
  )
  .join("\n")}`;

    const excludedSummary =
      excludedWikis.length > 0
        ? this.wikiSummarizationService.summarizeExcludedWikis(excludedWikis)
        : "";

    const recommendedStructure = ReadmePromptTemplates.buildRecommendedStructure(projectType);

    const finalInstructions = `OUTPUT REQUIREMENTS:

STRUCTURE AND ORDER:
Follow this recommended section order (include only sections that are relevant):
${recommendedStructure}

FORMATTING GUIDELINES:
- Start with H1 title: # ProjectName (use existing title if updating, create appropriate title if creating new)
- Use H2 (##) for main sections
- Use H3 (###) for subsections within main sections
- Use H4 (####) for sub-subsections if needed
- Include a Table of Contents if the README has 5+ main sections (use markdown links: [Section Name](#section-name))
- Use proper markdown formatting: bold for emphasis, italic for notes, code blocks with language identifiers
- Add horizontal rules (---) between major sections if the README is long (10+ sections)
- Use bullet points for lists, numbered lists for step-by-step instructions
- Include fenced code blocks with appropriate language identifiers (e.g., \`\`\`javascript, \`\`\`python, \`\`\`bash)

CONTENT GUIDELINES:
- Description: Write 2-4 sentences explaining what the project does, who it's for, and why it exists
- Installation: If applicable, include prerequisites and step-by-step installation instructions
- Usage: Provide clear examples showing how to use the project (incorporate wiki code examples here)
- Features: List key features/components, integrating wiki documentation into relevant feature descriptions
- Project Structure: Explain the directory organization (reference the project structure from context)
- Integrate wiki content appropriately - wikis document specific components, so place them in relevant feature/component sections
- Use code examples from wikis exactly as they appear - they are accurate and tested
- Add practical examples and use cases to make the README actionable

QUALITY STANDARDS:
- Be concise but comprehensive - include essential information without overwhelming readers
- Write for your target audience (developers, users, contributors) based on project type
- Use consistent terminology throughout the document
- Ensure all code examples are properly formatted and executable
- Make the README scannable with clear headings and proper spacing
- Remember: The README should represent the full project scope, with wikis enhancing specific documented areas

OUTPUT:
- Return ONLY the complete updated README.md content in Markdown format
- Do not include any meta-commentary, explanations, or notes outside the markdown
- Start immediately with the H1 title and proceed through all sections`;

    return [
      systemPrompt,
      projectOverviewSection,
      currentReadmeSection,
      instructions,
      wikisSection,
      excludedSummary,
      finalInstructions,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private getInstructionsForState(state: ReadmeState, isBoilerplate: boolean): string {
    switch (state) {
      case ReadmeState.NON_EXISTENT:
        return `The README.md file does not exist. Create a comprehensive, well-structured README from scratch that covers the entire project.

${ReadmePromptTemplates.getInstructionsForNewReadme()}`;

      case ReadmeState.AUTO_GENERATED:
      case ReadmeState.BOILERPLATE:
        return `The current README appears to be a boilerplate, template, or auto-generated content. Replace it with a comprehensive, well-structured README that covers the entire project.

${ReadmePromptTemplates.getInstructionsForNewReadme()}`;

      case ReadmeState.USER_CONTRIBUTED:
        return `The current README has existing user-contributed content with a specific style and structure. Your task is to:

${ReadmePromptTemplates.getInstructionsForUserContributed()}`;

      default:
        return isBoilerplate
          ? `The current README appears to be a boilerplate or template. Create a comprehensive, well-structured README from scratch that covers the entire project.

${ReadmePromptTemplates.getInstructionsForNewReadme()}`
          : `The current README has existing content with a specific style and structure. Your task is to:

${ReadmePromptTemplates.getInstructionsForExistingReadme()}`;
    }
  }

  private async buildProjectContext(): Promise<{
    rootName: string;
    overview: string;
    filesSample: string[];
  }> {
    try {
      const context = await this.projectContextService.buildContext(
        "",
        undefined,
        undefined,
        undefined,
      );
      return {
        rootName: context.rootName || "",
        overview: context.overview || "",
        filesSample: context.filesSample || [],
      };
    } catch (error) {
      this.logger.debug("Failed to build project context", error);
      return {
        rootName: "",
        overview: "",
        filesSample: [],
      };
    }
  }

  private buildProjectOverviewSection(
    projectContext: { rootName: string; overview: string; filesSample: string[] },
    projectType: {
      primaryLanguage: string;
      framework?: string;
      buildSystem?: string;
      packageManager?: string;
      confidence: number;
    },
  ): string {
    const sections: string[] = [];

    if (projectContext.rootName) {
      sections.push(`Project Name: ${projectContext.rootName}`);
    }

    if (projectType.primaryLanguage !== "unknown") {
      const typeInfo = [
        `Primary Language: ${projectType.primaryLanguage}`,
        projectType.framework ? `Framework: ${projectType.framework}` : undefined,
        projectType.buildSystem ? `Build System: ${projectType.buildSystem}` : undefined,
        projectType.packageManager ? `Package Manager: ${projectType.packageManager}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
      sections.push(typeInfo);
    }

    if (projectContext.overview) {
      sections.push(`Project Overview:\n${projectContext.overview}`);
    }

    if (projectContext.filesSample && projectContext.filesSample.length > 0) {
      const fileCount = projectContext.filesSample.length;
      const sampleSize = Math.min(30, fileCount);
      const fileList = projectContext.filesSample.slice(0, sampleSize).join("\n");
      const moreIndicator =
        fileCount > sampleSize ? `\n... and ${fileCount - sampleSize} more files` : "";
      sections.push(
        `Project Structure (showing ${sampleSize} of ${fileCount} files):\n${fileList}${moreIndicator}`,
      );
    }

    if (sections.length === 0) {
      return "";
    }

    return `PROJECT CONTEXT:
${sections.join("\n\n")}

Use this project context to understand the full scope and structure of the project. The saved wikis document specific components - integrate them appropriately within the broader project context.`;
  }
}
