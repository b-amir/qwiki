import {
  DocumentSymbolProvider,
  TextDocument,
  SymbolInformation,
  SymbolKind,
  Location,
  Uri,
  Position,
  Range,
} from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";

export class QwikiDocumentSymbolProvider implements DocumentSymbolProvider {
  private logger: Logger;
  private lastSymbolCounts = new Map<string, number>();
  private readonly LOG_THROTTLE_MS = 5000;
  private lastLogTime = new Map<string, number>();

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("QwikiDocumentSymbolProvider", loggingService);
  }

  async provideDocumentSymbols(document: TextDocument): Promise<SymbolInformation[]> {
    try {
      const symbols: SymbolInformation[] = [];
      const text = document.getText();
      const lines = text.split("\n");
      const languageId = document.languageId;
      const filePath = document.uri.fsPath;

      if (languageId === "typescript" || languageId === "javascript") {
        this.extractJavaScriptSymbols(document, lines, symbols);
      } else if (languageId === "python") {
        this.extractPythonSymbols(document, lines, symbols);
      } else if (languageId === "java") {
        this.extractJavaSymbols(document, lines, symbols);
      } else if (languageId === "csharp") {
        this.extractCSharpSymbols(document, lines, symbols);
      } else {
        this.extractGenericSymbols(document, lines, symbols);
      }

      const lastCount = this.lastSymbolCounts.get(filePath) ?? -1;
      const lastLog = this.lastLogTime.get(filePath) ?? 0;
      const now = Date.now();

      if (symbols.length !== lastCount || now - lastLog > this.LOG_THROTTLE_MS) {
        this.logger.debug("Document symbols extracted", {
          path: filePath,
          symbolCount: symbols.length,
          language: languageId,
          countChanged: symbols.length !== lastCount,
        });
        this.lastSymbolCounts.set(filePath, symbols.length);
        this.lastLogTime.set(filePath, now);
      }

      return symbols;
    } catch (error) {
      this.logger.error("Document symbol extraction failed", {
        path: document.uri.fsPath,
        language: document.languageId,
        error,
      });
      return [];
    }
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
      const line = lines[i].trim();

      const functionMatch = line.match(functionPattern);
      if (functionMatch) {
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
      if (classMatch) {
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
      if (interfaceMatch) {
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
      if (typeMatch) {
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
      if (constMatch && this.isSignificantConstant(line)) {
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
      const line = lines[i].trim();

      const functionMatch = line.match(functionPattern);
      if (functionMatch) {
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
      if (classMatch) {
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
      const line = lines[i].trim();

      const classMatch = line.match(classPattern);
      if (classMatch) {
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
      if (methodMatch && !line.includes("class") && !line.includes("interface")) {
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
      const line = lines[i].trim();

      const classMatch = line.match(classPattern);
      if (classMatch) {
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
      if (methodMatch && !line.includes("class") && !line.includes("interface")) {
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
      const line = lines[i].trim();

      const functionMatch = line.match(functionPattern);
      if (functionMatch) {
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
      if (classMatch) {
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
