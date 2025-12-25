import {
  DocumentSymbolProvider,
  SymbolInformation,
  TextDocument,
  CancellationToken,
  SymbolKind,
  Location,
  Range,
} from "vscode";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class QwikiDocumentSymbolProvider implements DocumentSymbolProvider {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("DocumentSymbolProvider");
  }

  provideDocumentSymbols(
    document: TextDocument,
    token: CancellationToken,
  ): Promise<SymbolInformation[]> {
    return new Promise((resolve) => {
      const symbols: SymbolInformation[] = [];
      const text = document.getText();
      const lines = text.split("\n");

      try {
        if (text.length > 500000) {
          this.logger.warn("Document too large for symbol extraction", {
            lineCount: lines.length,
            length: text.length,
          });
          resolve([]);
          return;
        }

        const languageId = document.languageId;

        switch (languageId) {
          case "typescript":
          case "javascript":
          case "typescriptreact":
          case "javascriptreact":
            this.extractJavaScriptSymbols(document, lines, symbols);
            break;
          case "python":
            this.extractPythonSymbols(document, lines, symbols);
            break;
          case "java":
            this.extractJavaSymbols(document, lines, symbols);
            break;
          case "csharp":
            this.extractCSharpSymbols(document, lines, symbols);
            break;
          default:
            this.extractGenericSymbols(document, lines, symbols);
        }

        resolve(symbols);
      } catch (error) {
        this.logger.error("Error providing document symbols", error);
        resolve([]);
      }
    });
  }

  private extractJavaScriptSymbols(
    document: TextDocument,
    lines: string[],
    symbols: SymbolInformation[],
  ): void {
    const functionPattern =
      /^(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*[=:]?\s*(?:async\s+)?\s*\(/;
    const classPattern = /^(?:export\s+)?(?:abstract\s+)?(?:class\s+)(\w+)/;
    const interfacePattern = /^(?:export\s+)?(?:interface\s+)(\w+)/;
    const typePattern = /^(?:export\s+)?(?:type\s+)(\w+)/;
    const constPattern = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      const line = rawLine.trim();

      const functionMatch = line.match(functionPattern);
      if (functionMatch && functionMatch[1]) {
        symbols.push(
          new SymbolInformation(
            functionMatch[1],
            SymbolKind.Function,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
        continue;
      }

      const classMatch = line.match(classPattern);
      if (classMatch && classMatch[1]) {
        symbols.push(
          new SymbolInformation(
            classMatch[1],
            SymbolKind.Class,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
        continue;
      }

      const interfaceMatch = line.match(interfacePattern);
      if (interfaceMatch && interfaceMatch[1]) {
        symbols.push(
          new SymbolInformation(
            interfaceMatch[1],
            SymbolKind.Interface,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
        continue;
      }

      const typeMatch = line.match(typePattern);
      if (typeMatch && typeMatch[1]) {
        symbols.push(
          new SymbolInformation(
            typeMatch[1],
            SymbolKind.TypeParameter,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
        continue;
      }

      const constMatch = line.match(constPattern);
      if (constMatch && constMatch[1] && this.isSignificantConstant(line)) {
        symbols.push(
          new SymbolInformation(
            constMatch[1],
            SymbolKind.Constant,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
      }
    }
  }

  private extractPythonSymbols(
    document: TextDocument,
    lines: string[],
    symbols: SymbolInformation[],
  ): void {
    const functionPattern = /^def\s+(\w+)\s*\(/;
    const classPattern = /^class\s+(\w+)/;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      const line = rawLine.trim();

      const functionMatch = line.match(functionPattern);
      if (functionMatch && functionMatch[1]) {
        symbols.push(
          new SymbolInformation(
            functionMatch[1],
            SymbolKind.Function,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
        continue;
      }

      const classMatch = line.match(classPattern);
      if (classMatch && classMatch[1]) {
        symbols.push(
          new SymbolInformation(
            classMatch[1],
            SymbolKind.Class,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
      }
    }
  }

  private extractJavaSymbols(
    document: TextDocument,
    lines: string[],
    symbols: SymbolInformation[],
  ): void {
    const methodPattern =
      /^(?:public|private|protected|static|\s)*\s*(?:[\w<>\[\]]+\s+)?(\w+)\s*\(/;
    const classPattern =
      /^(?:public|private|protected)?\s*(?:abstract\s+)?(?:class|interface|enum)\s+(\w+)/;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      const line = rawLine.trim();

      const classMatch = line.match(classPattern);
      if (classMatch && classMatch[1]) {
        symbols.push(
          new SymbolInformation(
            classMatch[1],
            SymbolKind.Class,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
        continue;
      }

      const methodMatch = line.match(methodPattern);
      if (methodMatch && methodMatch[1] && !line.includes("class") && !line.includes("interface")) {
        symbols.push(
          new SymbolInformation(
            methodMatch[1],
            SymbolKind.Method,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
      }
    }
  }

  private extractCSharpSymbols(
    document: TextDocument,
    lines: string[],
    symbols: SymbolInformation[],
  ): void {
    const methodPattern =
      /^(?:public|private|protected|internal|static|\s)*\s*(?:[\w<>\[\]]+\s+)?(\w+)\s*\(/;
    const classPattern =
      /^(?:public|private|protected|internal)?\s*(?:abstract\s+)?(?:class|interface|enum|struct)\s+(\w+)/;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      const line = rawLine.trim();

      const classMatch = line.match(classPattern);
      if (classMatch && classMatch[1]) {
        symbols.push(
          new SymbolInformation(
            classMatch[1],
            SymbolKind.Class,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
        continue;
      }

      const methodMatch = line.match(methodPattern);
      if (methodMatch && methodMatch[1] && !line.includes("class") && !line.includes("interface")) {
        symbols.push(
          new SymbolInformation(
            methodMatch[1],
            SymbolKind.Method,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
      }
    }
  }

  private extractGenericSymbols(
    document: TextDocument,
    lines: string[],
    symbols: SymbolInformation[],
  ): void {
    const functionPattern = /(?:function|fn|func)\s+(\w+)\s*\(/;
    const classPattern = /(?:class|struct)\s+(\w+)/;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      const line = rawLine.trim();

      const functionMatch = line.match(functionPattern);
      if (functionMatch && functionMatch[1]) {
        symbols.push(
          new SymbolInformation(
            functionMatch[1],
            SymbolKind.Function,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
        continue;
      }

      const classMatch = line.match(classPattern);
      if (classMatch && classMatch[1]) {
        symbols.push(
          new SymbolInformation(
            classMatch[1],
            SymbolKind.Class,
            "",
            new Location(document.uri, new Range(i, 0, i, line.length)),
          ),
        );
      }
    }
  }

  private isSignificantConstant(line: string): boolean {
    return (
      line.includes("=") &&
      (line.includes("const") || line.includes("let") || line.includes("var")) &&
      (line.includes("=>") ||
        line.includes("function") ||
        line.includes("class") ||
        !!line.match(/^[A-Z_][A-Z0-9_]*\s*=/))
    );
  }
}
