import {
  TextDocumentContentProvider,
  Uri,
  CancellationToken,
  EventEmitter,
  Event,
  workspace,
} from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import type { WikiStorageService } from "../application/services/WikiStorageService";

const QWIKI_SCHEME = "qwiki";

export class WikiContentProvider implements TextDocumentContentProvider {
  private logger: Logger;
  private _onDidChange = new EventEmitter<Uri>();

  constructor(
    private wikiStorageService: WikiStorageService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("WikiContentProvider", loggingService);
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  async provideTextDocumentContent(
    uri: Uri,
    token: CancellationToken,
  ): Promise<string> {
    try {
      if (token.isCancellationRequested) {
        return "";
      }

      const wikiId = uri.path;
      const wikis = await this.wikiStorageService.getAllSavedWikis();
      const wiki = wikis.find((w) => w.id === wikiId);

      if (!wiki) {
        return `# Wiki not found\n\nWiki with ID "${wikiId}" could not be found.`;
      }

      return wiki.content;
    } catch (error) {
      this.logger.error("Failed to provide text document content", error);
      return `# Error\n\nFailed to load wiki content: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  update(uri: Uri): void {
    this._onDidChange.fire(uri);
  }

  static createWikiUri(wikiId: string): Uri {
    return Uri.parse(`${QWIKI_SCHEME}://wiki/${wikiId}`);
  }
}
