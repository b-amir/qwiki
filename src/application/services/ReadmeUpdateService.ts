import { workspace, Uri } from "vscode";
import { join } from "path";
import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { WikiStorageService, type SavedWiki } from "./WikiStorageService";
import type { LLMRegistry } from "../../llm";
import type { ProviderId } from "../../llm/types";
import type { UpdateResult } from "../../domain/entities/ReadmeUpdate";

export interface ReadmeUpdateConfig {
  providerId: ProviderId;
  model?: string;
  backupOriginal?: boolean;
}

export class ReadmeUpdateService {
  private logger: Logger;
  private readonly readmeFileName = "README.md";
  private readonly boilerplatePatterns = [
    /^#\s+\w+\s*$/m,
    /getting.?started/i,
    /contributing/i,
    /license/i,
    /^#{1,2}\s+(Installation|Usage|Contributing|License)\s*$/m,
  ];

  constructor(
    private wikiStorageService: WikiStorageService,
    private llmRegistry: LLMRegistry,
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("ReadmeUpdateService", loggingService);
  }

  async updateReadmeFromWikis(
    wikiIds: string[],
    config: ReadmeUpdateConfig,
  ): Promise<UpdateResult> {
    this.logger.debug(`Updating README from ${wikiIds.length} wikis`);

    try {
      const allWikis = await this.wikiStorageService.getAllSavedWikis();
      const wikis = allWikis.filter((w) => wikiIds.includes(w.id));

      if (wikis.length === 0) {
        throw new Error("No wikis found for the provided IDs");
      }

      const currentReadme = await this.readCurrentReadme();
      const isBoilerplate = this.detectBoilerplateReadme(currentReadme);

      let backupPath: string | undefined;
      if (config.backupOriginal) {
        backupPath = await this.createReadmeBackup();
      }

      const prompt = this.buildReadmeUpdatePrompt(currentReadme, wikis, isBoilerplate);
      const result = await this.llmRegistry.generate(config.providerId, {
        model: config.model,
        snippet: prompt,
        languageId: "markdown",
        filePath: "README.md",
      });

      await this.writeReadme(result.content);

      if (this.eventBus) {
        this.eventBus.publish("readme-updated", {
          wikiCount: wikis.length,
        });
      }

      return {
        success: true,
        changes: ["README updated successfully"],
        backupPath,
        conflicts: [],
      };
    } catch (error) {
      this.logger.error("Failed to update README", error);
      return {
        success: false,
        changes: [],
        conflicts: [
          `Failed to update README: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }

  private detectBoilerplateReadme(content: string): boolean {
    if (!content || content.trim().length < 100) {
      return true;
    }

    const lowerContent = content.toLowerCase();
    const matchesPattern = this.boilerplatePatterns.some((pattern) => pattern.test(content));
    const hasGenericContent =
      lowerContent.includes("getting started") &&
      lowerContent.includes("contributing") &&
      lowerContent.includes("license");

    return matchesPattern || hasGenericContent;
  }

  private buildReadmeUpdatePrompt(
    currentReadme: string,
    wikis: SavedWiki[],
    isBoilerplate: boolean,
  ): string {
    const systemPrompt = `You are an expert technical documentation specialist. Your task is to update a project README.md file by integrating documentation from saved wiki entries.

CRITICAL RULES:
1. Return ONLY raw Markdown content - no explanations, no commentary
2. Maintain professional documentation standards
3. Use clear section headings and consistent formatting
4. Preserve code examples from the wikis exactly as they appear
5. Create logical flow and organization`;

    const currentReadmeSection = currentReadme
      ? `CURRENT README CONTENT:
\`\`\`markdown
${currentReadme}
\`\`\``
      : "";

    const instructions = isBoilerplate
      ? `The current README appears to be a boilerplate or template. Create a comprehensive, well-structured README from scratch using the wiki content below.

The README should include:
- A clear project title and description
- Installation instructions (if available in wikis)
- Usage examples and key features
- Code examples and API documentation (from wikis)
- Any other relevant sections based on the wiki content

Make it professional, informative, and useful for developers.`
      : `The current README has existing content with a specific style and structure. Your task is to:

1. Analyze the existing README's style, tone, and structure
2. Integrate the wiki content by appending or updating relevant sections
3. Maintain the existing README's formatting style (markdown structure, heading levels, code block styles)
4. Preserve all existing content that is still relevant
5. Add new sections or update existing ones with information from the wikis
6. Ensure the updated README flows naturally and maintains consistency

Follow the style and structure of the existing README. If a section already exists, update it with information from the wikis. If new information doesn't fit existing sections, add new sections that match the README's style.`;

    const wikisSection = `WIKI CONTENT TO INTEGRATE:
${wikis
  .map(
    (wiki, index) => `## Wiki ${index + 1}: ${wiki.title}
${wiki.content}
---
`,
  )
  .join("\n")}`;

    const finalInstructions = `OUTPUT REQUIREMENTS:
- Return ONLY the complete updated README.md content in Markdown format
- Start with the H1 title (use existing title if updating, create appropriate title if creating new)
- Use H2 for main sections (## Section Name)
- Use H3 for subsections (### Subsection Name)
- Include code blocks with appropriate language identifiers
- Ensure all content is properly formatted and readable
- Do not include any meta-commentary or explanations outside the markdown`;

    return [systemPrompt, currentReadmeSection, instructions, wikisSection, finalInstructions]
      .filter(Boolean)
      .join("\n\n");
  }

  async createReadmeBackup(): Promise<string> {
    const content = await this.readCurrentReadme();
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace root found");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `README.backup.${timestamp}.md`;
    const backupPath = join(workspaceRoot, backupFileName);

    const backupUri = Uri.file(backupPath);
    await workspace.fs.writeFile(backupUri, Buffer.from(content, "utf8"));

    return backupPath;
  }

  private async readCurrentReadme(): Promise<string> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return "";
    }

    const readmePath = join(workspaceRoot, this.readmeFileName);
    const readmeUri = Uri.file(readmePath);

    try {
      const content = await workspace.fs.readFile(readmeUri);
      return Buffer.from(content).toString("utf8");
    } catch {
      return "";
    }
  }

  private async writeReadme(content: string): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace root found");
    }

    const readmePath = join(workspaceRoot, this.readmeFileName);
    const readmeUri = Uri.file(readmePath);

    await workspace.fs.writeFile(readmeUri, Buffer.from(content, "utf8"));
  }

  private getWorkspaceRoot(): string | undefined {
    const workspaceFolders = workspace.workspaceFolders;
    return workspaceFolders?.[0]?.uri.fsPath;
  }
}
