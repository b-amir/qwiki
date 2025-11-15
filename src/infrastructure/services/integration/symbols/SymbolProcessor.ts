import { Position, Uri, SymbolInformation, DocumentSymbol } from "vscode";

export class SymbolProcessor {
  findSymbolAtPosition(
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

  isSymbolInformation(symbol: SymbolInformation | DocumentSymbol): symbol is SymbolInformation {
    return "location" in symbol;
  }

  convertDocumentSymbolToSymbolInformation(symbol: DocumentSymbol, uri: Uri): SymbolInformation {
    return new SymbolInformation(symbol.name, symbol.kind, symbol.detail || "", {
      uri,
      range: symbol.range,
    });
  }
}
