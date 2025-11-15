import { CancellationToken, workspace, Uri, Position } from "vscode";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { LanguageServerIntegrationService } from "@/infrastructure/services";
import type { WikiGenerationRequest } from "@/domain/entities/Wiki";

export class SemanticInfoCollector {
  private logger: Logger;

  constructor(
    private languageServerIntegrationService?: LanguageServerIntegrationService,
    loggingService?: LoggingService,
  ) {
    this.logger = loggingService
      ? createLogger("SemanticInfoCollector")
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
  }

  async collectSemanticInfo(
    request: WikiGenerationRequest,
    cancellationToken?: CancellationToken,
  ): Promise<any | null> {
    if (!this.languageServerIntegrationService || !request.filePath) {
      return null;
    }

    if (cancellationToken?.isCancellationRequested) {
      return null;
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
        this.logger.debug("Collected semantic info", {
          symbolName: semanticInfo.symbolName,
          symbolKind: semanticInfo.symbolKind,
          hasType: !!semanticInfo.type,
          hasReturnType: !!semanticInfo.returnType,
        });
      }

      return semanticInfo;
    } catch (error: any) {
      this.logger.debug("Failed to collect semantic info", {
        error: error?.message,
        filePath: request.filePath,
      });
      return null;
    }
  }

  private getSelectionFromSnippet(document: any, snippet: string): Position | null {
    try {
      const documentText = document.getText();
      const snippetStart = documentText.indexOf(snippet);

      if (snippetStart === -1) {
        const firstLine = snippet.split("\n")[0];
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
