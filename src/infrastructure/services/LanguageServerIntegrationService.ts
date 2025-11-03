import {
  commands,
  workspace,
  TextDocument,
  Position,
  Uri,
  SymbolInformation,
  SymbolKind,
  DocumentSymbol,
} from "vscode";
import { LoggingService, createLogger, type Logger } from "./LoggingService";

export interface SemanticCodeInfo {
  symbolName: string;
  symbolKind: SymbolKind;
  location: Uri;
  type?: string;
  isAsync?: boolean;
  parameters?: Array<{ name: string; type?: string }>;
  returnType?: string;
  documentation?: string;
}

export class LanguageServerIntegrationService {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("LanguageServerIntegrationService", loggingService);
  }

  async getSemanticInfoForSelection(
    document: TextDocument,
    selectionText: string,
    position: Position,
  ): Promise<SemanticCodeInfo | null> {
    try {
      const symbols = await commands.executeCommand<Array<SymbolInformation | DocumentSymbol>>(
        "vscode.executeDocumentSymbolProvider",
        document.uri,
      );

      if (!symbols || symbols.length === 0) {
        return null;
      }

      const symbolAtPosition = this.findSymbolAtPosition(symbols, position);

      if (!symbolAtPosition) {
        this.logger.debug("No symbol found at position", {
          path: document.uri.fsPath,
          line: position.line,
          character: position.character,
        });
        return null;
      }

      const semanticInfo: SemanticCodeInfo = {
        symbolName: symbolAtPosition.name,
        symbolKind: symbolAtPosition.kind,
        location: this.isSymbolInformation(symbolAtPosition)
          ? symbolAtPosition.location.uri
          : document.uri,
      };

      await this.enrichWithLanguageServerData(document, symbolAtPosition, semanticInfo);

      this.logger.debug("Retrieved semantic info", {
        symbolName: semanticInfo.symbolName,
        symbolKind: semanticInfo.symbolKind,
        hasType: !!semanticInfo.type,
        hasReturnType: !!semanticInfo.returnType,
      });

      return semanticInfo;
    } catch (error) {
      this.logger.error("Failed to get semantic info for selection", error);
      return null;
    }
  }

  async getSymbolsForFile(uri: Uri): Promise<SymbolInformation[]> {
    try {
      const symbols = await commands.executeCommand<Array<SymbolInformation | DocumentSymbol>>(
        "vscode.executeDocumentSymbolProvider",
        uri,
      );

      if (!symbols) {
        return [];
      }

      const symbolInfos: SymbolInformation[] = [];
      for (const symbol of symbols) {
        if (this.isSymbolInformation(symbol)) {
          symbolInfos.push(symbol);
        } else {
          symbolInfos.push(this.convertDocumentSymbolToSymbolInformation(symbol, uri));
        }
      }

      return symbolInfos;
    } catch (error) {
      this.logger.error("Failed to get symbols for file", { uri: uri.fsPath, error });
      return [];
    }
  }

  async getTypeInformation(document: TextDocument, position: Position): Promise<string | null> {
    try {
      const hovers = await commands.executeCommand<any[]>(
        "vscode.executeHoverProvider",
        document.uri,
        position,
      );

      if (!hovers || hovers.length === 0) {
        return null;
      }

      const hover = hovers[0];
      if (hover?.contents && hover.contents.length > 0) {
        const content = hover.contents[0];
        if (typeof content === "string") {
          return this.extractTypeFromHover(content);
        }
      }

      return null;
    } catch (error) {
      this.logger.debug("Failed to get type information", { error });
      return null;
    }
  }

  private async enrichWithLanguageServerData(
    document: TextDocument,
    symbol: SymbolInformation | DocumentSymbol,
    semanticInfo: SemanticCodeInfo,
  ): Promise<void> {
    try {
      const position = this.isSymbolInformation(symbol)
        ? symbol.location.range.start
        : symbol.range.start;

      const hovers = await commands.executeCommand<any[]>(
        "vscode.executeHoverProvider",
        document.uri,
        position,
      );

      if (!hovers || hovers.length === 0) {
        return;
      }

      const hover = hovers[0];
      if (hover?.contents && hover.contents.length > 0) {
        const content = hover.contents[0];
        if (typeof content === "string") {
          semanticInfo.type = this.extractTypeFromHover(content) || undefined;
          semanticInfo.documentation = this.extractDocumentation(content);
          semanticInfo.isAsync = this.detectAsync(content);
          semanticInfo.parameters = this.extractParameters(content);
          semanticInfo.returnType = this.extractReturnType(content);
        }
      }
    } catch (error) {
      this.logger.debug("Failed to enrich semantic info", { error });
    }
  }

  private findSymbolAtPosition(
    symbols: Array<SymbolInformation | DocumentSymbol>,
    position: Position,
  ): SymbolInformation | DocumentSymbol | null {
    for (const symbol of symbols) {
      const range = this.isSymbolInformation(symbol) ? symbol.location.range : symbol.range;
      if (
        range.contains(position) ||
        (range.start.line === position.line &&
          range.start.character <= position.character &&
          range.end.character >= position.character)
      ) {
        return symbol;
      }
    }
    return null;
  }

  private isSymbolInformation(
    symbol: SymbolInformation | DocumentSymbol,
  ): symbol is SymbolInformation {
    return "location" in symbol;
  }

  private convertDocumentSymbolToSymbolInformation(
    symbol: DocumentSymbol,
    uri: Uri,
  ): SymbolInformation {
    return new SymbolInformation(symbol.name, symbol.kind, symbol.detail || "", {
      uri,
      range: symbol.range,
    });
  }

  private extractTypeFromHover(content: string): string | null {
    const typeMatch = content.match(/(?:type|Type):\s*([^\n]+)/i);
    if (typeMatch) {
      return typeMatch[1].trim();
    }

    const functionMatch = content.match(/(?:function|fn|method)\s+(\w+)\s*[<(]/);
    if (functionMatch) {
      return "function";
    }

    const classMatch = content.match(/class\s+(\w+)/);
    if (classMatch) {
      return "class";
    }

    return null;
  }

  private extractDocumentation(content: string): string | undefined {
    const docMatch = content.match(/(?:@description|@param|@returns?)\s+(.+)/i);
    return docMatch ? docMatch[1].trim() : undefined;
  }

  private detectAsync(content: string): boolean {
    return /async|Promise|Future/.test(content);
  }

  private extractParameters(content: string): Array<{ name: string; type?: string }> | undefined {
    const paramMatches = content.matchAll(/@param\s+(\w+)\s+(.+)/gi);
    const params: Array<{ name: string; type?: string }> = [];
    for (const match of paramMatches) {
      params.push({
        name: match[1],
        type: match[2]?.trim(),
      });
    }
    return params.length > 0 ? params : undefined;
  }

  private extractReturnType(content: string): string | undefined {
    const returnMatch = content.match(/(?:@returns?|@return)\s+(.+)/i);
    return returnMatch ? returnMatch[1].trim() : undefined;
  }
}
