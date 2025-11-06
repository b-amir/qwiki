import { DocumentLinkProvider, DocumentLink, TextDocument, Range, Uri } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";

const FILE_LINK_PATTERN = /\[([^\]]+)\]\(openfile:([^\)]+)\)/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^\)]+\.(md|qwiki\.md))\)/g;

export class WikiDocumentLinkProvider implements DocumentLinkProvider {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("WikiDocumentLinkProvider");
  }

  provideDocumentLinks(document: TextDocument): DocumentLink[] {
    try {
      const links: DocumentLink[] = [];
      const text = document.getText();
      const lines = text.split("\n");

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let match: RegExpExecArray | null;

        FILE_LINK_PATTERN.lastIndex = 0;
        while ((match = FILE_LINK_PATTERN.exec(line)) !== null) {
          const filePath = match[2];
          const startPos = match.index;
          const endPos = match.index + match[0].length;
          const range = new Range(lineIndex, startPos, lineIndex, endPos);

          try {
            const uri = Uri.file(filePath);
            links.push(new DocumentLink(range, uri));
          } catch (error) {
            this.logger.debug(`Invalid file path in link: ${filePath}`, error);
          }
        }

        MARKDOWN_LINK_PATTERN.lastIndex = 0;
        while ((match = MARKDOWN_LINK_PATTERN.exec(line)) !== null) {
          const filePath = match[2];
          const startPos = match.index;
          const endPos = match.index + match[0].length;
          const range = new Range(lineIndex, startPos, lineIndex, endPos);

          try {
            const uri = Uri.file(filePath);
            links.push(new DocumentLink(range, uri));
          } catch (error) {
            this.logger.debug(`Invalid markdown link: ${filePath}`, error);
          }
        }
      }

      return links;
    } catch (error) {
      this.logger.error("Failed to provide document links", error);
      return [];
    }
  }
}
