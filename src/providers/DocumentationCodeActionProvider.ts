import { CodeActionProvider, CodeAction, TextDocument, Range, CodeActionKind } from "vscode";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../infrastructure/services/LoggingService";
import { VSCodeCommandIds } from "../constants";

export class DocumentationCodeActionProvider implements CodeActionProvider {
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("DocumentationCodeActionProvider");
  }

  provideCodeActions(document: TextDocument, range: Range): CodeAction[] {
    const action = new CodeAction("Generate a quick wiki", CodeActionKind.Refactor);
    action.command = {
      command: VSCodeCommandIds.createQuickWiki,
      title: "Generate a quick wiki",
      arguments: [],
    };
    action.isPreferred = true;

    return [action];
  }
}
