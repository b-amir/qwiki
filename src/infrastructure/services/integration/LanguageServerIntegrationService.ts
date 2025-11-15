import {
  commands,
  TextDocument,
  Position,
  Uri,
  SymbolInformation,
  SymbolKind,
  DocumentSymbol,
  CancellationToken,
} from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import type { EventBus } from "@/events/EventBus";
import { OutboundEvents } from "@/constants/Events";
import { ErrorCodes } from "@/constants/ErrorCodes";
import { DebouncingService } from "@/infrastructure/services/optimization/DebouncingService";
import { CachingService } from "@/infrastructure/services/caching/CachingService";
import { SymbolProcessor } from "@/infrastructure/services/integration/symbols/SymbolProcessor";
import { HoverContentExtractor } from "@/infrastructure/services/integration/hover/HoverContentExtractor";
import {
  ServerCapabilityDetector,
  type ServerCapabilities,
} from "./capabilities/ServerCapabilityDetector";
import { SemanticInfoEnricher } from "@/infrastructure/services/integration/enrichment/SemanticInfoEnricher";

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
  private symbolProcessor: SymbolProcessor;
  private hoverExtractor: HoverContentExtractor;
  private capabilityDetector: ServerCapabilityDetector;
  private semanticEnricher: SemanticInfoEnricher;

  constructor(
    private loggingService: LoggingService,
    private eventBus?: EventBus,
    private debouncingService?: DebouncingService,
    private cachingService?: CachingService,
  ) {
    this.logger = createLogger("LanguageServerIntegrationService");
    this.symbolProcessor = new SymbolProcessor();
    this.hoverExtractor = new HoverContentExtractor();
    this.capabilityDetector = new ServerCapabilityDetector(this.logger);
    this.semanticEnricher = new SemanticInfoEnricher(this.logger);
  }

  async getSemanticInfoForSelection(
    document: TextDocument,
    selectionText: string,
    position: Position,
    cancellationToken?: CancellationToken,
  ): Promise<SemanticCodeInfo | null> {
    if (cancellationToken?.isCancellationRequested) {
      return null;
    }

    try {
      const capabilities = await this.capabilityDetector.getServerCapabilities(document);
      if (!capabilities.hasDocumentSymbols) {
        this.logger.debug("Document symbols not available for language", {
          language: document.languageId,
        });
        return null;
      }

      const symbols = await commands.executeCommand<Array<SymbolInformation | DocumentSymbol>>(
        "vscode.executeDocumentSymbolProvider",
        document.uri,
      );

      if (cancellationToken?.isCancellationRequested) {
        return null;
      }

      if (!symbols || symbols.length === 0) {
        return null;
      }

      const symbolAtPosition = this.symbolProcessor.findSymbolAtPosition(symbols, position);

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
        location: this.symbolProcessor.isSymbolInformation(symbolAtPosition)
          ? symbolAtPosition.location.uri
          : document.uri,
      };

      await this.semanticEnricher.enrichWithLanguageServerData(
        document,
        symbolAtPosition,
        semanticInfo,
        capabilities,
        cancellationToken,
      );

      this.logger.debug("Retrieved semantic info", {
        symbolName: semanticInfo.symbolName,
        symbolKind: semanticInfo.symbolKind,
        hasType: !!semanticInfo.type,
        hasReturnType: !!semanticInfo.returnType,
      });

      return semanticInfo;
    } catch (error: any) {
      this.logger.error("Failed to get semantic info for selection", error);
      this.publishError(
        "Failed to retrieve semantic code information",
        ErrorCodes.unknown,
        "The language server may not be available. Try again later.",
        { filePath: document.uri.fsPath, error: error?.message },
        error?.message,
      );
      return null;
    }
  }

  async getSymbolsForFile(
    uri: Uri,
    cancellationToken?: CancellationToken,
  ): Promise<SymbolInformation[]> {
    if (cancellationToken?.isCancellationRequested) {
      return [];
    }

    const cacheKey = `symbols:${uri.fsPath}`;
    if (this.cachingService) {
      const cached = await this.cachingService.get<SymbolInformation[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const symbols = await commands.executeCommand<Array<SymbolInformation | DocumentSymbol>>(
        "vscode.executeDocumentSymbolProvider",
        uri,
      );

      if (cancellationToken?.isCancellationRequested) {
        return [];
      }

      if (!symbols) {
        return [];
      }

      const symbolInfos: SymbolInformation[] = [];
      for (const symbol of symbols) {
        if (this.symbolProcessor.isSymbolInformation(symbol)) {
          symbolInfos.push(symbol);
        } else {
          symbolInfos.push(
            this.symbolProcessor.convertDocumentSymbolToSymbolInformation(symbol, uri),
          );
        }
      }

      if (this.cachingService && symbolInfos.length > 0) {
        await this.cachingService.set(cacheKey, symbolInfos, { ttl: 300000 });
      }

      return symbolInfos;
    } catch (error: any) {
      this.logger.error("Failed to get symbols for file", { uri: uri.fsPath, error });
      this.publishError(
        "Failed to retrieve symbols for file",
        ErrorCodes.unknown,
        "The language server may not be available for this file type.",
        { filePath: uri.fsPath, error: error?.message },
        error?.message,
      );
      return [];
    }
  }

  async getTypeInformation(
    document: TextDocument,
    position: Position,
    cancellationToken?: CancellationToken,
  ): Promise<string | null> {
    if (cancellationToken?.isCancellationRequested) {
      return null;
    }

    const capabilities = await this.capabilityDetector.getServerCapabilities(document);
    if (!capabilities.hasHover) {
      return null;
    }

    try {
      const hovers = await commands.executeCommand<any[]>(
        "vscode.executeHoverProvider",
        document.uri,
        position,
      );

      if (cancellationToken?.isCancellationRequested) {
        return null;
      }

      if (!hovers || hovers.length === 0) {
        return null;
      }

      const hover = hovers[0];
      if (hover?.contents && hover.contents.length > 0) {
        const content = hover.contents[0];
        if (typeof content === "string") {
          return this.hoverExtractor.extractTypeFromHover(content);
        }
      }

      return null;
    } catch (error: any) {
      this.logger.debug("Failed to get type information", { error });
      return null;
    }
  }

  private publishError(
    message: string,
    code: string,
    suggestion?: string,
    context?: any,
    originalError?: string,
  ): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish(OutboundEvents.error, {
      code,
      message,
      suggestions: suggestion ? [suggestion] : undefined,
      suggestion,
      timestamp: new Date().toISOString(),
      context: context ? JSON.stringify(context) : undefined,
      originalError,
    });
  }
}
