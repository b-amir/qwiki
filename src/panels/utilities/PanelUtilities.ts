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

  async cancelActiveGeneration(reason?: string): Promise<void> {
    try {
      const container = this.bootstrap.getContainer();
      const handler = await container.resolveLazyTyped("wikiEventHandler");
      if (handler && "cancelActiveGeneration" in handler && typeof handler.cancelActiveGeneration === "function") {
        handler.cancelActiveGeneration(reason);
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
