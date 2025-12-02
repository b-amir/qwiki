import { workspace, FileType } from "vscode";
import { join } from "path";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { VSCodeFileSystemService } from "@/infrastructure/services";

export interface SavedWiki {
  id: string;
  title: string;
  content: string;
  filePath: string;
  createdAt: Date;
  tags: string[];
  sourceFilePath?: string;
}

export class WikiStorageService {
  private readonly qwikiFolderName = ".qwiki";
  private logger: Logger;

  constructor(
    private vscodeFileSystem: VSCodeFileSystemService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("WikiStorageService");
  }

  async saveWiki(title: string, content: string, sourceFilePath?: string): Promise<SavedWiki> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      throw new Error("No workspace folder found");
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const qwikiFolderPath = join(workspaceRoot, this.qwikiFolderName);
    const savedFolderPath = join(qwikiFolderPath, "saved");

    if (!(await this.vscodeFileSystem.fileExists(qwikiFolderPath))) {
      await this.vscodeFileSystem.createDirectory(qwikiFolderPath);
    }

    if (!(await this.vscodeFileSystem.fileExists(savedFolderPath))) {
      await this.vscodeFileSystem.createDirectory(savedFolderPath);
    }

    const sanitizedName = this.sanitizeFileName(title);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}-${sanitizedName}.md`;
    const wikiFilePath = join(savedFolderPath, fileName);

    const wikiContent = this.formatWikiContent(title, content, sourceFilePath);

    await this.vscodeFileSystem.writeFile(wikiFilePath, wikiContent, true);

    const savedWiki: SavedWiki = {
      id: timestamp,
      title,
      content: wikiContent,
      filePath: wikiFilePath,
      createdAt: new Date(),
      tags: this.extractTags(content),
      sourceFilePath: sourceFilePath || undefined,
    };

    return savedWiki;
  }

  async getAllSavedWikis(): Promise<SavedWiki[]> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      this.logger.debug("No workspace folders found");
      return [];
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const qwikiFolderPath = join(workspaceRoot, this.qwikiFolderName);
    const savedFolderPath = join(qwikiFolderPath, "saved");

    try {
      const entries = await this.vscodeFileSystem.readDirectory(savedFolderPath);
      this.logger.debug(`Found ${entries.length} entries in saved folder: ${savedFolderPath}`);

      const wikis: SavedWiki[] = [];
      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const [name, type] of entries) {
        const isFile = (type & FileType.File) === FileType.File;
        const isMarkdown = name.endsWith(".md");

        if (isFile && isMarkdown) {
          try {
            const filePath = join(savedFolderPath, name);
            this.logger.debug(`Processing wiki file: ${name}`);
            const contentStr = await this.vscodeFileSystem.readFile(filePath, true);
            const parsed = this.parseWikiContent(contentStr, filePath);
            wikis.push(parsed);
            processedCount++;
          } catch (error) {
            errorCount++;
            this.logger.error(`Failed to read wiki file ${name}`, {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
          }
        } else {
          skippedCount++;
          if (!isFile) {
            this.logger.debug(`Skipping non-file entry: ${name} (type: ${type})`);
          } else if (!isMarkdown) {
            this.logger.debug(`Skipping non-markdown file: ${name}`);
          }
        }
      }

      this.logger.debug(
        `Processed ${processedCount} wikis, skipped ${skippedCount} entries, ${errorCount} errors`,
      );
      return wikis.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("does not exist") || errorMessage.includes("ENOENT")) {
        this.logger.debug(`Saved folder does not exist: ${savedFolderPath}`);
      } else {
        this.logger.error("Failed to get saved wikis", {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          savedFolderPath,
        });
      }
      return [];
    }
  }

  async deleteWiki(wikiId: string): Promise<void> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const qwikiFolderPath = join(workspaceRoot, this.qwikiFolderName);
    const savedFolderPath = join(qwikiFolderPath, "saved");

    try {
      if (!(await this.vscodeFileSystem.fileExists(savedFolderPath))) {
        return;
      }

      const entries = await this.vscodeFileSystem.readDirectory(savedFolderPath);
      for (const [name, type] of entries) {
        const isFile = (type & FileType.File) === FileType.File;
        if (isFile && name.startsWith(wikiId) && name.endsWith(".md")) {
          const filePath = join(savedFolderPath, name);
          await this.vscodeFileSystem.delete(filePath);
          break;
        }
      }
    } catch (error) {
      this.logger.error("Failed to delete wiki", error);
      return;
    }
  }

  private sanitizeFileName(title: string): string {
    return title
      .replace(/[^a-z0-9\s-]/gi, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .substring(0, 50);
  }

  private formatWikiContent(title: string, content: string, sourceFilePath?: string): string {
    const metadata = [
      "---",
      `title: ${title}`,
      `created: ${new Date().toISOString()}`,
      sourceFilePath ? `source: ${sourceFilePath}` : "",
      "---",
      "",
    ]
      .filter(Boolean)
      .join("\n");

    return metadata + content;
  }

  private parseWikiContent(content: string, filePath: string): SavedWiki {
    const lines = content.split("\n");
    let title = "";
    let created = "";
    let source = "";
    let bodyStartIndex = 0;

    if (lines[0] === "---") {
      let metadataEndIndex = -1;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith("---")) {
          metadataEndIndex = i;
          break;
        }
      }

      if (metadataEndIndex > 0) {
        const metadataLines = lines.slice(1, metadataEndIndex);
        for (const line of metadataLines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith("title: ")) title = trimmedLine.substring(7);
          if (trimmedLine.startsWith("created: ")) created = trimmedLine.substring(9);
          if (trimmedLine.startsWith("source: ")) {
            source = trimmedLine.substring(8);
          }
        }
        bodyStartIndex = metadataEndIndex + 1;
      }
    }

    const body = lines.slice(bodyStartIndex).join("\n").trim();

    const fileNameMatch = filePath.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z?)-(.+)\.md$/);
    const id = fileNameMatch?.[1] || new Date().toISOString();
    let parsedTitle = title || this.extractTitleFromBody(body) || "Untitled";
    if (parsedTitle.length > 36) {
      parsedTitle = parsedTitle.substring(0, 33) + "...";
    }

    return {
      id,
      title: parsedTitle,
      content: body,
      filePath,
      createdAt: created ? new Date(created) : new Date(),
      tags: this.extractTags(body),
      sourceFilePath: source ? source.trim() : undefined,
    };
  }

  private extractTitleFromBody(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    if (match) {
      const title = match[1].trim();
      return title.length > 36 ? title.substring(0, 33) + "..." : title;
    }

    const functionMatch = content.match(
      /(?:function|class|const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
    );
    if (functionMatch) {
      return functionMatch[1];
    }

    const exportMatch = content.match(
      /export\s+(?:default\s+)?(?:function|class|const|let|var)?\s*([a-zA-Z_][a-zA-Z0-9_]*)/,
    );
    if (exportMatch) {
      return exportMatch[1];
    }

    return null;
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];

    const codeBlockMatches = content.match(/```(\w+)/g);
    if (codeBlockMatches) {
      for (const match of codeBlockMatches) {
        const lang = match.substring(3).trim();
        if (lang && !tags.includes(lang)) {
          tags.push(lang);
        }
      }
    }

    const linkMatches = content.match(/\[([^\]]+)\]\(openfile:([^\)]+)\)/g);
    if (linkMatches) {
      const extensions = new Set<string>();
      for (const match of linkMatches) {
        const pathMatch = match.match(/openfile:([^\)]+\.(\w+))/);
        if (pathMatch) {
          extensions.add(pathMatch[2]);
        }
      }
      tags.push(...Array.from(extensions));
    }

    return tags;
  }
}
