import {
  HoverProvider,
  Hover,
  TextDocument,
  Position,
  Range,
  MarkdownString,
  Uri,
  workspace,
} from "vscode";
import type { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class DocumentationHoverProvider implements HoverProvider {
  private logger: Logger;

  constructor(
    private wikiStorageService: WikiStorageService,
    private loggingService: LoggingService,
    private extensionUri?: Uri,
  ) {
    this.logger = createLogger("DocumentationHoverProvider");
  }

  async provideHover(document: TextDocument, position: Position): Promise<Hover | null> {
    try {
      const lineText = document.lineAt(position.line).text;
      const wordRange = document.getWordRangeAtPosition(position);

      if (!wordRange) {
        return null;
      }

      const word = document.getText(wordRange);
      const currentFilePath = document.uri.fsPath;
      const wikis = await this.wikiStorageService.getAllSavedWikis();

      const matchingWiki = this.findMatchingWiki(wikis, currentFilePath, word);

      if (!matchingWiki) {
        return null;
      }

      const cleanedContent = this.stripTitleAndMetadata(matchingWiki.content);
      const whatItIsSection = this.extractWhatItIsSection(cleanedContent);
      const markdown = new MarkdownString();

      if (whatItIsSection) {
        const cleanedSection = this.removeAllHeadings(whatItIsSection);
        markdown.appendMarkdown(
          `$(book) <span style="font-size: 0.9em;">Qwiki page:</span>\n\n${cleanedSection.trim()}`,
        );
      } else {
        const preview = this.extractPreview(cleanedContent, 200);
        const cleanedPreview = this.removeAllHeadings(preview);
        markdown.appendMarkdown(
          `$(book) <span style="font-size: 0.9em;">Qwiki page:</span>\n\n${cleanedPreview}`,
        );
      }

      const fileUri = Uri.file(matchingWiki.filePath);
      const commandUri = Uri.parse(
        `command:vscode.open?${encodeURIComponent(JSON.stringify([fileUri]))}`,
      );

      markdown.appendMarkdown(`\n\n[Show full wiki](${commandUri.toString()})`);
      markdown.isTrusted = true;
      markdown.supportThemeIcons = true;

      return new Hover(markdown, wordRange);
    } catch (error) {
      this.logger.error("Failed to provide hover", error);
      return null;
    }
  }

  private findMatchingWiki(
    wikis: Array<{ content: string; filePath: string; title: string; sourceFilePath?: string }>,
    currentFilePath: string,
    word: string,
  ): { content: string; filePath: string } | null {
    const normalizedCurrentPath = this.normalizePath(currentFilePath);

    const wikisFromThisFile = wikis.filter((wiki) => {
      const sourcePath = wiki.sourceFilePath;
      if (!sourcePath) {
        return false;
      }
      const normalizedSourcePath = this.normalizePath(sourcePath);
      return normalizedSourcePath === normalizedCurrentPath;
    });

    if (wikisFromThisFile.length === 0) {
      return null;
    }

    const wordLower = word.toLowerCase();

    for (const wiki of wikisFromThisFile) {
      const title = wiki.title.toLowerCase();

      if (
        title === wordLower ||
        title.includes(wordLower) ||
        title.includes(`${wordLower}-`) ||
        title.includes(`-${wordLower}`)
      ) {
        return wiki;
      }

      if (wiki.content.toLowerCase().includes(wordLower)) {
        return wiki;
      }
    }

    return wikisFromThisFile[0] ?? null;
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, "/").toLowerCase();
  }

  private extractSourcePath(content: string): string | null {
    const lines = content.split("\n");
    if (lines[0] === "---") {
      const metadataEndIndex = lines.indexOf("---", 1);
      if (metadataEndIndex > 0) {
        const metadataLines = lines.slice(1, metadataEndIndex);
        for (const line of metadataLines) {
          if (line.startsWith("source: ")) {
            return line.substring(8).trim();
          }
        }
      }
    }
    return null;
  }

  private stripTitleAndMetadata(content: string): string {
    let cleaned = content;

    cleaned = cleaned.replace(/^---[\s\S]*?---\s*\n?/m, "");
    cleaned = cleaned.replace(/^#\s+.+?\n+/m, "");
    cleaned = cleaned.trim();

    return cleaned;
  }

  private extractWhatItIsSection(content: string): string | null {
    const lines = content.split("\n");
    let whatItIsStartIndex = -1;
    let whatItIsEndIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] ?? "").trim();
      if (/^#\s+What\s+It\s+Is\s*$/i.test(line)) {
        whatItIsStartIndex = i + 1;
        break;
      }
    }

    if (whatItIsStartIndex === -1) {
      return null;
    }

    for (let i = whatItIsStartIndex; i < lines.length; i++) {
      const line = (lines[i] ?? "").trim();
      if (line === "#" || (line.startsWith("#") && /^#\s+\w/.test(line))) {
        if (i > whatItIsStartIndex) {
          whatItIsEndIndex = i;
          break;
        }
      }
    }

    const sectionLines = lines.slice(whatItIsStartIndex, whatItIsEndIndex);
    const result = sectionLines.join("\n").trim();
    return result || null;
  }

  private removeAllHeadings(content: string): string {
    let cleaned = content;
    cleaned = cleaned.replace(/^#{1,6}\s+.+$/gm, "");
    cleaned = cleaned.replace(/^##\s+.+$/gm, "");
    cleaned = cleaned.replace(/^###\s+.+$/gm, "");
    cleaned = cleaned.replace(/^####\s+.+$/gm, "");
    cleaned = cleaned.replace(/^#####\s+.+$/gm, "");
    cleaned = cleaned.replace(/^######\s+.+$/gm, "");
    return cleaned.trim();
  }

  private extractPreview(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 0) {
      return truncated.substring(0, lastSpace) + "...";
    }
    return truncated + "...";
  }
}
