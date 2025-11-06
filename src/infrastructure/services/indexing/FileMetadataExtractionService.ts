import { workspace, Uri } from "vscode";
import type { IndexedFile } from "../ProjectIndexService";
import { LoggingService, createLogger, type Logger } from "../LoggingService";

export class FileMetadataExtractionService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("FileMetadataExtractionService");
  }

  async extractFileMetadata(uri: Uri, size: number): Promise<IndexedFile> {
    try {
      const doc = await workspace.openTextDocument(uri);
      const languageId = doc.languageId;
      const imports = this.extractImportsFromDocument(doc);

      return {
        uri,
        path: uri.fsPath,
        language: languageId,
        size,
        modifiedTime: Date.now(),
        isSourceFile: this.isSourceFile(uri.fsPath, languageId),
        metadata: {
          imports,
        },
      };
    } catch (error) {
      return {
        uri,
        path: uri.fsPath,
        language: undefined,
        size,
        modifiedTime: Date.now(),
        isSourceFile: false,
      };
    }
  }

  private extractImportsFromDocument(doc: {
    lineCount: number;
    lineAt(line: number): { text: string };
  }): string[] {
    const imports: string[] = [];
    const importPattern =
      /^import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]+\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/;

    for (let i = 0; i < Math.min(doc.lineCount, 50); i++) {
      const line = doc.lineAt(i).text;
      const match = line.match(importPattern);
      if (match && match[1]) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  private isSourceFile(filePath: string, language?: string): boolean {
    if (!language) return false;
    const sourceExtensions = /\.(ts|tsx|js|jsx|py|java|go|rs|php|rb|cs|swift|kt)$/;
    return sourceExtensions.test(filePath);
  }
}
