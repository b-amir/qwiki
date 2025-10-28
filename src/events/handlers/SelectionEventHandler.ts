import type { EventBus } from "../EventBus";
import type { Selection } from "../../domain/entities/Selection";
import { InboundEvents, OutboundEvents } from "../../constants/Events";

export class SelectionEventHandler {
  constructor(private eventBus: EventBus) {}

  register(): void {
    this.eventBus.subscribe(InboundEvents.getSelection, this.handleGetSelection.bind(this));
  }

  private async handleGetSelection(payload: { allowFallback?: boolean }): Promise<void> {
    const { allowFallback = true } = payload;

    const selection = await this.getSelection(allowFallback);
    this.eventBus.publish(OutboundEvents.selection, selection);
  }

  private async getSelection(allowFallback: boolean): Promise<Selection | undefined> {
    const { window } = await import("vscode");
    const editor = window.activeTextEditor;

    if (!editor) {
      return undefined;
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
