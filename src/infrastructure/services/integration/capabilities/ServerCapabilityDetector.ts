import { commands, TextDocument, Position, SymbolInformation, DocumentSymbol } from "vscode";
import type { Logger } from "@/infrastructure/services";

export interface ServerCapabilities {
  hasDocumentSymbols: boolean;
  hasHover: boolean;
  language: string;
}

export class ServerCapabilityDetector {
  private capabilityCache = new Map<string, ServerCapabilities>();

  constructor(private logger: Logger) {}

  async getServerCapabilities(document: TextDocument): Promise<ServerCapabilities> {
    const language = document.languageId;
    const cached = this.capabilityCache.get(language);
    if (cached) {
      return cached;
    }

    const capabilities: ServerCapabilities = {
      hasDocumentSymbols: false,
      hasHover: false,
      language,
    };

    try {
      const symbols = await commands.executeCommand<Array<SymbolInformation | DocumentSymbol>>(
        "vscode.executeDocumentSymbolProvider",
        document.uri,
      );
      capabilities.hasDocumentSymbols = symbols !== null && symbols !== undefined;

      const hovers = await commands.executeCommand<any[]>(
        "vscode.executeHoverProvider",
        document.uri,
        new Position(0, 0),
      );
      capabilities.hasHover = hovers !== null && hovers !== undefined && hovers.length > 0;
    } catch (error) {
      this.logger.debug("Failed to detect server capabilities", { language, error });
    }

    this.capabilityCache.set(language, capabilities);
    return capabilities;
  }
}
