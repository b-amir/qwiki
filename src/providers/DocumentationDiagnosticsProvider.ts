import {
  Diagnostic,
  DiagnosticSeverity,
  TextDocument,
  DiagnosticCollection,
  languages,
  Range,
} from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import type { WikiStorageService } from "../application/services/WikiStorageService";

export class DocumentationDiagnosticsProvider {
  private logger: Logger;
  private diagnosticCollection: DiagnosticCollection;

  constructor(
    private wikiStorageService: WikiStorageService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("DocumentationDiagnosticsProvider");
    this.diagnosticCollection = languages.createDiagnosticCollection("qwiki");
  }

  async analyzeDocumentation(document: TextDocument): Promise<void> {
    try {
      const diagnostics: Diagnostic[] = [];
      const text = document.getText();
      const lines = text.split("\n");

      const wikis = await this.wikiStorageService.getAllSavedWikis();
      const wikiMap = new Map(
        wikis.map((wiki) => [this.extractFilePathFromWiki(wiki.filePath), wiki]),
      );

      const currentFilePath = document.uri.fsPath;
      const existingWiki = wikiMap.get(currentFilePath);

      if (!existingWiki) {
        return;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (this.isCodeDefinition(trimmed) && !this.hasDocumentation(lines, i)) {
          const range = new Range(i, 0, i, line.length);
          diagnostics.push(
            new Diagnostic(
              range,
              "Code definition without documentation",
              DiagnosticSeverity.Information,
            ),
          );
        }
      }

      this.diagnosticCollection.set(document.uri, diagnostics);
    } catch (error) {
      this.logger.error("Failed to analyze documentation", error);
    }
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }

  private extractFilePathFromWiki(wikiFilePath: string): string {
    const sourceMatch = wikiFilePath.match(/source:\s*(.+)/);
    return sourceMatch ? sourceMatch[1] : "";
  }

  private isCodeDefinition(line: string): boolean {
    const definitionPattern =
      /^(export\s+)?(function|class|const|let|var|interface|type|enum)\s+\w+/;
    return definitionPattern.test(line);
  }

  private hasDocumentation(lines: string[], lineIndex: number): boolean {
    if (lineIndex === 0) {
      return false;
    }

    const prevLine = lines[lineIndex - 1].trim();
    const prevPrevLine = lineIndex > 1 ? lines[lineIndex - 2].trim() : "";

    return (
      prevLine.startsWith("//") ||
      prevLine.startsWith("*") ||
      prevPrevLine.startsWith("/**") ||
      prevPrevLine.startsWith("*")
    );
  }
}
