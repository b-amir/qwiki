import { window } from "vscode";
import type { Selection } from "@/domain/entities/Selection";

export class SelectionService {
  private lastSelection: Selection | undefined;

  getCurrentSelection(allowFallback = true): Selection | undefined {
    const editor = window.activeTextEditor;
    if (!editor) {
      return allowFallback ? this.lastSelection : undefined;
    }

    const { document, selection } = editor;
    const hasSelection = selection && !selection.isEmpty;
    const text = hasSelection ? document.getText(selection) : document.getText();

    const currentSelection = {
      text: text ?? "",
      languageId: document.languageId,
      filePath: document.uri.fsPath,
    };

    this.lastSelection = currentSelection;
    return currentSelection;
  }

  getLastSelection(): Selection | undefined {
    return this.lastSelection;
  }
}
