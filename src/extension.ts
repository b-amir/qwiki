import { ExtensionContext, window, commands } from "vscode";
import { QwikiPanel } from "./panels/QwikiPanel";
import { VSCodeCommandIds } from "./constants/Commands";
import { Pages } from "./constants/Events";

export function activate(context: ExtensionContext) {
  const provider = new QwikiPanel(context.extensionUri, context);

  context.subscriptions.push(
    window.registerWebviewViewProvider(VSCodeCommandIds.wikiViewId, provider),
  );

  const showQwikiCommand = commands.registerCommand(VSCodeCommandIds.showPanel, () => {
    commands.executeCommand(VSCodeCommandIds.openPanelView);
  });

  const showSettingsCommand = commands.registerCommand(VSCodeCommandIds.viewSettings, () => {
    provider.showPage(Pages.settings);
  });

  const createQuickWikiCommand = commands.registerCommand(VSCodeCommandIds.createQuickWiki, () => {
    provider.createWikiFromEditorSelection();
  });

  context.subscriptions.push(showQwikiCommand, showSettingsCommand, createQuickWikiCommand);
}

export function deactivate() {}
