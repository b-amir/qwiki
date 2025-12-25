import { CancellationToken, workspace, Uri, Position, type TextDocument } from "vscode";
import { createLogger, type Logger, type SemanticCodeInfo } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { LanguageServerIntegrationService } from "@/infrastructure/services";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";
import * as crypto from "crypto";

interface CachedSemanticInfo {
  info: SemanticCodeInfo;
  cachedAt: number;
}

export class SemanticInfoCollector {
  private logger: Logger;
  private semanticInfoCache = new Map<string, CachedSemanticInfo>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private languageServerIntegrationService?: LanguageServerIntegrationService,
    loggingService?: LoggingService,
  ) {
    this.logger = loggingService
      ? createLogger("SemanticInfoCollector")
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
  }

  private getCacheKey(filePath: string, snippet: string): string {
    const snippetHash = crypto.createHash("sha256").update(snippet).digest("hex").slice(0, 16);
    return `${filePath}:${snippetHash}`;
  }

  async collectSemanticInfo(
    request: WikiGenerationRequest,
    cancellationToken?: CancellationToken,
  ): Promise<SemanticCodeInfo | null> {
    if (!this.languageServerIntegrationService || !request.filePath) {
      return null;
    }

    if (cancellationToken?.isCancellationRequested) {
      return null;
    }

    const cacheKey = this.getCacheKey(request.filePath, request.snippet);
    const cached = this.semanticInfoCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.cachedAt < this.CACHE_TTL_MS) {
      this.logger.debug("Using cached semantic info", {
        filePath: request.filePath,
        symbolName: cached.info.symbolName,
      });
      return cached.info;
    }

    try {
      const document = await workspace.openTextDocument(Uri.file(request.filePath));
      const selection = this.getSelectionFromSnippet(document, request.snippet);

      if (!selection) {
        this.logger.debug("Could not determine selection position for semantic info");
        return null;
      }

      const semanticInfo = await this.languageServerIntegrationService.getSemanticInfoForSelection(
        document,
        request.snippet,
        selection,
        cancellationToken,
      );

      if (semanticInfo) {
        this.semanticInfoCache.set(cacheKey, {
          info: semanticInfo,
          cachedAt: now,
        });
        this.logger.debug("Collected and cached semantic info", {
          symbolName: semanticInfo.symbolName,
          symbolKind: semanticInfo.symbolKind,
          hasType: !!semanticInfo.type,
          hasReturnType: !!semanticInfo.returnType,
        });
      }

      return semanticInfo;
    } catch (error: unknown) {
      const errObj = error as Record<string, unknown> | null;
      this.logger.debug("Failed to collect semantic info", {
        error: errObj?.message,
        filePath: request.filePath,
      });
      return null;
    }
  }

  private getSelectionFromSnippet(document: TextDocument, snippet: string): Position | null {
    try {
      const documentText = document.getText();
      const snippetStart = documentText.indexOf(snippet);

      if (snippetStart === -1) {
        const firstLine = snippet.split("\n")[0] ?? "";
        const firstLineIndex = documentText.indexOf(firstLine);
        if (firstLineIndex === -1) {
          return new Position(0, 0);
        }
        const textBefore = documentText.substring(0, firstLineIndex);
        const lineNumber = textBefore.split("\n").length - 1;
        return new Position(lineNumber, 0);
      }

      const textBefore = documentText.substring(0, snippetStart);
      const lineNumber = textBefore.split("\n").length - 1;
      const columnNumber = textBefore.split("\n").pop()?.length || 0;

      return new Position(lineNumber, columnNumber);
    } catch (error) {
      return null;
    }
  }
}
