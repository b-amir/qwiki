import { workspace, Uri } from "vscode";
import { join } from "path";
import { EventBus } from "../../events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";
import { WikiStorageService, type SavedWiki } from "./WikiStorageService";
import { ReadmeSectionGenerator } from "./readme/ReadmeSectionGenerator";
import { ReadmeParser } from "./readme/ReadmeParser";
import type {
  ReadmeUpdateConfig,
  ReadmeSection,
  UpdateResult,
  ReadmeAnalysis,
  CustomSection,
  ReadmeStructure,
  ReadmePreview,
  SectionChange,
  ReadmeStructureValidation,
} from "../../domain/entities/ReadmeUpdate";
import type { MergeStrategy } from "../../domain/entities/WikiAggregation";

export class ReadmeUpdateService {
  private logger: Logger;
  private readonly readmeFileName = "README.md";
  private sectionGenerator: ReadmeSectionGenerator;
  private parser: ReadmeParser;

  constructor(
    private wikiStorageService: WikiStorageService,
    private loggingService: LoggingService,
    private eventBus?: EventBus,
  ) {
    this.logger = createLogger("ReadmeUpdateService", loggingService);
    this.sectionGenerator = new ReadmeSectionGenerator();
    this.parser = new ReadmeParser();
  }

  async updateReadmeFromWikis(
    wikiIds: string[],
    config: ReadmeUpdateConfig,
  ): Promise<UpdateResult> {
    this.logger.debug(`Updating README from ${wikiIds.length} wikis`);

    const allWikis = await this.wikiStorageService.getAllSavedWikis();
    const wikis = allWikis.filter((w) => wikiIds.includes(w.id));

    const currentReadme = await this.readCurrentReadme();
    const analysis = await this.analyzeCurrentReadme();
    const newSections = await this.generateReadmeSections(wikis, currentReadme);

    let backupPath: string | undefined;
    if (config.backupOriginal) {
      backupPath = await this.createReadmeBackup();
    }

    const mergedSections = await this.mergeReadmeSections(
      analysis.sections,
      newSections,
      "categorical",
    );

    const updatedContent = this.buildReadmeContent(mergedSections, analysis.customSections, config);
    const validation = await this.validateReadmeStructure(updatedContent);

    const changes: string[] = [];
    const conflicts: string[] = [];

    if (!validation.isValid) {
      conflicts.push(...validation.errors);
    }

    if (validation.warnings.length > 0) {
      changes.push(...validation.warnings);
    }

    try {
      await this.writeReadme(updatedContent);
      changes.push("README updated successfully");

      if (this.eventBus) {
        this.eventBus.publish("readme-updated", {
          wikiCount: wikis.length,
          sectionsUpdated: mergedSections.length,
        });
      }

      return {
        success: true,
        changes,
        backupPath,
        conflicts,
      };
    } catch (error) {
      this.logger.error("Failed to update README", error);
      return {
        success: false,
        changes,
        backupPath,
        conflicts: [...conflicts, `Failed to write README: ${error}`],
      };
    }
  }

  async analyzeCurrentReadme(): Promise<ReadmeAnalysis> {
    const content = await this.readCurrentReadme();
    const sections = this.parser.extractSections(content);
    const customSections = this.parser.extractCustomSections(content);
    const structure = this.parser.analyzeStructure(content);

    return {
      sections,
      customSections,
      structure,
      hasExistingContent: content.length > 0,
    };
  }

  async generateReadmeSections(
    wikis: SavedWiki[],
    currentReadme: string,
  ): Promise<ReadmeSection[]> {
    const sections: ReadmeSection[] = [];

    const overview = await this.sectionGenerator.generateProjectOverview(wikis);
    if (overview) {
      sections.push({
        name: "Overview",
        content: overview,
        priority: 10,
      });
    }

    const installation = await this.sectionGenerator.generateInstallationGuide(wikis);
    if (installation) {
      sections.push({
        name: "Installation",
        content: installation,
        priority: 9,
      });
    }

    const usage = await this.sectionGenerator.generateUsageSection(wikis);
    if (usage) {
      sections.push({
        name: "Usage",
        content: usage,
        priority: 8,
      });
    }

    const apiDocs = await this.sectionGenerator.generateApiDocumentation(wikis);
    if (apiDocs) {
      sections.push({
        name: "API Documentation",
        content: apiDocs,
        priority: 7,
      });
    }

    return sections;
  }

  async mergeReadmeSections(
    current: ReadmeSection[],
    newSections: ReadmeSection[],
    strategy: MergeStrategy,
  ): Promise<ReadmeSection[]> {
    const merged: ReadmeSection[] = [];
    const currentMap = new Map<string, ReadmeSection>();

    for (const section of current) {
      currentMap.set(section.name.toLowerCase(), section);
    }

    const newMap = new Map<string, ReadmeSection>();
    for (const section of newSections) {
      newMap.set(section.name.toLowerCase(), section);
    }

    const allSectionNames = new Set([...currentMap.keys(), ...newMap.keys()]);

    for (const sectionName of allSectionNames) {
      const currentSection = currentMap.get(sectionName);
      const newSection = newMap.get(sectionName);

      if (currentSection && newSection) {
        merged.push({
          ...newSection,
          priority: Math.max(currentSection.priority, newSection.priority),
        });
      } else if (newSection) {
        merged.push(newSection);
      } else if (currentSection) {
        merged.push(currentSection);
      }
    }

    return merged.sort((a, b) => b.priority - a.priority);
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

  async validateReadmeStructure(content: string): Promise<ReadmeStructureValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push("README is empty");
    }

    if (content.length < 100) {
      warnings.push("README is very short");
    }

    if (!/^#\s/.test(content)) {
      warnings.push("README may be missing a title (H1 heading)");
    }

    const hasLinks = /\[.*?\]\(.*?\)/.test(content);
    if (!hasLinks) {
      warnings.push("README may benefit from links to documentation or resources");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async previewReadmeUpdate(wikiIds: string[], config: ReadmeUpdateConfig): Promise<ReadmePreview> {
    const allWikis = await this.wikiStorageService.getAllSavedWikis();
    const wikis = allWikis.filter((w) => wikiIds.includes(w.id));

    const original = await this.readCurrentReadme();
    const analysis = await this.analyzeCurrentReadme();
    const newSections = await this.generateReadmeSections(wikis, original);

    const mergedSections = await this.mergeReadmeSections(
      analysis.sections,
      newSections,
      "categorical",
    );

    const updated = this.buildReadmeContent(mergedSections, analysis.customSections, config);

    const changes: SectionChange[] = [];
    const originalSectionNames = new Set(analysis.sections.map((s) => s.name.toLowerCase()));
    const newSectionNames = new Set(newSections.map((s) => s.name.toLowerCase()));

    for (const section of mergedSections) {
      const sectionName = section.name.toLowerCase();
      if (originalSectionNames.has(sectionName) && newSectionNames.has(sectionName)) {
        changes.push({
          section: section.name,
          action: "updated",
          content: section.content.substring(0, 200),
        });
      } else if (newSectionNames.has(sectionName)) {
        changes.push({
          section: section.name,
          action: "added",
          content: section.content.substring(0, 200),
        });
      } else {
        changes.push({
          section: section.name,
          action: "preserved",
          content: section.content.substring(0, 200),
        });
      }
    }

    const warnings: string[] = [];
    if (mergedSections.length === 0) {
      warnings.push("No sections generated from wikis");
    }

    return {
      original,
      updated,
      changes,
      warnings,
    };
  }

  private async generateProjectOverview(wikis: SavedWiki[]): Promise<string> {
    if (wikis.length === 0) return "";

    const overview = wikis
      .map((wiki) => {
        const firstParagraph = wiki.content.split("\n\n")[0];
        return firstParagraph.substring(0, 300);
      })
      .join("\n\n");

    return overview || "";
  }

  private async generateInstallationGuide(wikis: SavedWiki[]): Promise<string> {
    const installationWikis = wikis.filter(
      (w) => /install|setup|getting.?started/i.test(w.title) || /install|setup/i.test(w.content),
    );

    if (installationWikis.length === 0) return "";

    const content = installationWikis.map((wiki) => wiki.content).join("\n\n");
    return content.substring(0, 1000);
  }

  private async generateUsageSection(wikis: SavedWiki[]): Promise<string> {
    const usageWikis = wikis.filter(
      (w) => /usage|example|how.?to|tutorial/i.test(w.title) || /usage|example/i.test(w.content),
    );

    if (usageWikis.length === 0) {
      const codeExamples = wikis
        .filter((w) => /```/.test(w.content))
        .map((w) => w.content.match(/```[\s\S]*?```/)?.[0])
        .filter(Boolean)
        .slice(0, 3);

      if (codeExamples.length > 0) {
        return codeExamples.join("\n\n");
      }
      return "";
    }

    return usageWikis
      .map((wiki) => wiki.content)
      .join("\n\n")
      .substring(0, 1000);
  }

  private async generateApiDocumentation(wikis: SavedWiki[]): Promise<string> {
    const apiWikis = wikis.filter(
      (w) =>
        /api|endpoint|function|method|class|interface/i.test(w.title) ||
        /api|endpoint|function/i.test(w.content),
    );

    if (apiWikis.length === 0) return "";

    return apiWikis
      .map((wiki) => {
        const title = wiki.title;
        const content = wiki.content.substring(0, 500);
        return `### ${title}\n\n${content}`;
      })
      .join("\n\n");
  }

  private buildReadmeContent(
    sections: ReadmeSection[],
    customSections: CustomSection[],
    config: ReadmeUpdateConfig,
  ): string {
    const parts: string[] = [];

    for (const section of sections) {
      if (config.sections.length === 0 || config.sections.includes(section.name)) {
        parts.push(section.content);
      }
    }

    if (config.preserveCustom) {
      for (const customSection of customSections) {
        parts.push(customSection.content);
      }
    }

    return parts.join("\n\n");
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
