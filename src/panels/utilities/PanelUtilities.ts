import { window } from "vscode";
import type { SelectionPayload } from "@/panels/NavigationManager";
import type { Logger } from "@/infrastructure/services";
import type { AppBootstrap } from "@/application";

export class PanelUtilities {
  constructor(
    private logger: Logger,
    private bootstrap: AppBootstrap,
    private navigationManager?: { getLastSelection(): SelectionPayload | undefined },
  ) {}

  async cancelActiveGeneration(): Promise<void> {
    try {
      const container = this.bootstrap.getContainer();
      const handler = await container.resolveLazy("wikiEventHandler");
      if (handler && typeof (handler as any).cancelActiveGeneration === "function") {
        (handler as any).cancelActiveGeneration();
      }
    } catch (error) {
      this.logger.debug("Failed to cancel active generation", error);
    }
  }

  readSelectionFromEditor(allowFallback = true): SelectionPayload | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return allowFallback ? this.navigationManager?.getLastSelection() : undefined;
    }
    const { document, selection } = editor;
    const hasSelection = selection && !selection.isEmpty;
    const text = hasSelection ? document.getText(selection) : document.getText();
    return {
      text: text ?? "",
      languageId: document.languageId,
      filePath: document.uri.fsPath,
    };
  }
}
