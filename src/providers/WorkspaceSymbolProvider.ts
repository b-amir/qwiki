import {
  WorkspaceSymbolProvider,
  SymbolInformation,
  SymbolKind,
  Location,
  Uri,
  Position,
  Range,
} from "vscode";
import type {
  WikiStorageService,
  SavedWiki,
} from "../application/services/storage/WikiStorageService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class QwikiWorkspaceSymbolProvider implements WorkspaceSymbolProvider {
  private logger: Logger;

  constructor(
    private wikiStorageService: WikiStorageService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("QwikiWorkspaceSymbolProvider");
  }

  async provideWorkspaceSymbols(query: string): Promise<SymbolInformation[]> {
    try {
      if (!query.trim()) {
        return [];
      }

      const wikis = await this.wikiStorageService.getAllSavedWikis();
      const queryLower = query.toLowerCase();
      const symbols: SymbolInformation[] = [];

      for (const wiki of wikis) {
        if (
          wiki.title.toLowerCase().includes(queryLower) ||
          wiki.content.toLowerCase().includes(queryLower) ||
          wiki.tags.some((tag) => tag.toLowerCase().includes(queryLower))
        ) {
          symbols.push(
            new SymbolInformation(
              wiki.title,
              SymbolKind.String,
              wiki.filePath,
              new Location(
                Uri.file(wiki.filePath),
                new Range(new Position(0, 0), new Position(0, 0)),
              ),
            ),
          );
        }
      }

      this.logger.debug(`Found ${symbols.length} matching wiki symbols for query: ${query}`);
      return symbols;
    } catch (error) {
      this.logger.error("Failed to provide workspace symbols", error);
      return [];
    }
  }
}
