import {
  commands,
  TextDocument,
  Position,
  SymbolInformation,
  DocumentSymbol,
  CancellationToken,
} from "vscode";
import type { Logger } from "@/infrastructure/services";
import type { SemanticCodeInfo } from "@/infrastructure/services/integration/LanguageServerIntegrationService";
import { SymbolProcessor } from "@/infrastructure/services/integration/symbols/SymbolProcessor";
import { HoverContentExtractor } from "@/infrastructure/services/integration/hover/HoverContentExtractor";
import type { ServerCapabilities } from "@/infrastructure/services/integration/capabilities/ServerCapabilityDetector";

export class SemanticInfoEnricher {
  private symbolProcessor: SymbolProcessor;
  private hoverExtractor: HoverContentExtractor;

  constructor(private logger: Logger) {
    this.symbolProcessor = new SymbolProcessor();
    this.hoverExtractor = new HoverContentExtractor();
  }

  async enrichWithLanguageServerData(
    document: TextDocument,
    symbol: SymbolInformation | DocumentSymbol,
    semanticInfo: SemanticCodeInfo,
    capabilities: ServerCapabilities,
    cancellationToken?: CancellationToken,
  ): Promise<void> {
    if (cancellationToken?.isCancellationRequested) {
      return;
    }

    if (!capabilities.hasHover) {
      return;
    }

    try {
      const position = this.symbolProcessor.isSymbolInformation(symbol)
        ? symbol.location.range.start
        : symbol.range.start;

      const hovers = await commands.executeCommand<any[]>(
        "vscode.executeHoverProvider",
        document.uri,
        position,
      );

      if (cancellationToken?.isCancellationRequested) {
        return;
      }

      if (!hovers || hovers.length === 0) {
        return;
      }

      const hover = hovers[0];
      if (hover?.contents && hover.contents.length > 0) {
        const content = hover.contents[0];
        if (typeof content === "string") {
          semanticInfo.type = this.hoverExtractor.extractTypeFromHover(content) || undefined;
          semanticInfo.documentation = this.hoverExtractor.extractDocumentation(content);
          semanticInfo.isAsync = this.hoverExtractor.detectAsync(content);
          semanticInfo.parameters = this.hoverExtractor.extractParameters(content);
          semanticInfo.returnType = this.hoverExtractor.extractReturnType(content);
        }
      }
    } catch (error: unknown) {
      this.logger.debug("Failed to enrich semantic info", { error });
    }
  }
}
