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
import type { IndexCacheService } from "@/infrastructure/services/indexing/IndexCacheService";

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
    private indexCacheService?: IndexCacheService | null,
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

      let symbols: Array<SymbolInformation | DocumentSymbol> | undefined;

      if (this.indexCacheService) {
        const cachedSymbols = await this.indexCacheService.getSymbols(document.uri.fsPath);
        if (cachedSymbols && cachedSymbols.length > 0) {
          this.logger.debug("Using cached symbols from index", {
            filePath: document.uri.fsPath,
            symbolCount: cachedSymbols.length,
          });
          symbols = cachedSymbols;
        }
      }

      if (!symbols) {
        const queryPromise = commands.executeCommand<Array<SymbolInformation | DocumentSymbol>>(
          "vscode.executeDocumentSymbolProvider",
          document.uri,
        );

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Language server query timeout")), 10000);
        });

        try {
          symbols = await Promise.race([queryPromise, timeoutPromise]);
        } catch (error: unknown) {
          const errObj = error as Record<string, unknown> | null;
          const errMsg = errObj?.message as string | undefined;
          if (errMsg?.includes("timeout")) {
            this.logger.warn("Language server query timeout, using fallback", {
              filePath: document.uri.fsPath,
            });
            return this.fallbackToCodeAnalysis(document, position);
          }
          throw error;
        }

        if (this.indexCacheService && symbols && symbols.length > 0) {
          const documentSymbols = symbols.filter(
            (s): s is DocumentSymbol => !this.symbolProcessor.isSymbolInformation(s),
          );
          if (documentSymbols.length > 0) {
            await this.indexCacheService.setSymbols(document.uri.fsPath, documentSymbols);
          }
        }
      }

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
    } catch (error: unknown) {
      this.logger.error("Failed to get semantic info for selection", error);
      return this.fallbackToCodeAnalysis(document, position);
    }
  }

  private fallbackToCodeAnalysis(
    document: TextDocument,
    position: Position,
  ): SemanticCodeInfo | null {
    try {
      const line = document.lineAt(position.line);
      const text = line.text.trim();

      const functionMatch = text.match(/(?:function|const|let|var)\s+(\w+)/);
      const classMatch = text.match(/class\s+(\w+)/);

      const symbolName = functionMatch?.[1] || classMatch?.[1] || "unknown";
      const symbolKind = classMatch ? SymbolKind.Class : SymbolKind.Function;

      this.logger.debug("Using code analysis fallback", {
        symbolName,
        symbolKind,
        filePath: document.uri.fsPath,
      });

      return {
        symbolName,
        symbolKind,
        location: document.uri,
      };
    } catch (error) {
      this.logger.debug("Fallback code analysis failed", { error });
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
    } catch (error: unknown) {
      const errObj = error as Record<string, unknown> | null;
      this.logger.error("Failed to get symbols for file", { uri: uri.fsPath, error });
      this.publishError(
        "Failed to retrieve symbols for file",
        ErrorCodes.unknown,
        "The language server may not be available for this file type.",
        { filePath: uri.fsPath, error: errObj?.message },
        errObj?.message as string | undefined,
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
    } catch (error: unknown) {
      this.logger.debug("Failed to get type information", { error });
      return null;
    }
  }

  private publishError(
    message: string,
    code: string,
    suggestion?: string,
    context?: Record<string, unknown>,
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
