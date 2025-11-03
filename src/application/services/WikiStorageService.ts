import { workspace, Uri } from "vscode";
import { join } from "path";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

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

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("WikiStorageService", loggingService);
  }

  async saveWiki(title: string, content: string, sourceFilePath?: string): Promise<SavedWiki> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      throw new Error("No workspace folder found");
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const qwikiFolderPath = join(workspaceRoot, this.qwikiFolderName);

    const qwikiFolderUri = Uri.file(qwikiFolderPath);

    try {
      await workspace.fs.stat(qwikiFolderUri);
    } catch {
      await workspace.fs.createDirectory(qwikiFolderUri);
    }

    const sanitizedName = this.sanitizeFileName(title);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}-${sanitizedName}.md`;
    const wikiFilePath = join(qwikiFolderPath, fileName);

    const wikiContent = this.formatWikiContent(title, content, sourceFilePath);
    const wikiFileUri = Uri.file(wikiFilePath);

    await workspace.fs.writeFile(wikiFileUri, Buffer.from(wikiContent, "utf8"));

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
      return [];
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const qwikiFolderPath = join(workspaceRoot, this.qwikiFolderName);
    const qwikiFolderUri = Uri.file(qwikiFolderPath);

    try {
      const entries = await workspace.fs.readDirectory(qwikiFolderUri);
      const wikis: SavedWiki[] = [];

      for (const [name, type] of entries) {
        if (type === 1 && name.endsWith(".md")) {
          try {
            const fileUri = Uri.file(join(qwikiFolderPath, name));
            const content = await workspace.fs.readFile(fileUri);
            const contentStr = Buffer.from(content).toString("utf8");
            const parsed = this.parseWikiContent(contentStr, fileUri.fsPath);
            wikis.push(parsed);
          } catch (error) {
            this.logger.error(`Failed to read wiki file ${name}`, error);
          }
        }
      }

      return wikis.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch {
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

    try {
      const entries = await workspace.fs.readDirectory(Uri.file(qwikiFolderPath));
      for (const [name, type] of entries) {
        if (type === 1 && name.startsWith(wikiId) && name.endsWith(".md")) {
          const fileUri = Uri.file(join(qwikiFolderPath, name));
          await workspace.fs.delete(fileUri);
          break;
        }
      }
    } catch {
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
