import { buildProjectContext } from "../../panels/contextBuilder";
import type { Selection, ProjectContext } from "../../domain/entities/Selection";
import type { Webview } from "vscode";

export class ProjectContextService {
  async buildContext(
    snippet: string,
    filePath?: string,
    languageId?: string,
    webview?: Webview,
  ): Promise<ProjectContext> {
    return buildProjectContext(snippet, filePath, languageId, webview);
  }
}
