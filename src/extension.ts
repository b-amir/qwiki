import { ExtensionContext, window, commands } from "vscode";
import { QwikiPanel } from "./panels/QwikiPanel";
import { VSCodeCommandIds, Pages } from "./constants";

let qwikiProvider: QwikiPanel | undefined;

export function activate(context: ExtensionContext) {
  qwikiProvider = new QwikiPanel(context.extensionUri, context);

  context.subscriptions.push(
    window.registerWebviewViewProvider(VSCodeCommandIds.wikiViewId, qwikiProvider),
  );

  const showQwikiCommand = commands.registerCommand(VSCodeCommandIds.showPanel, () => {
    commands.executeCommand(VSCodeCommandIds.openPanelView);
  });

  const showSettingsCommand = commands.registerCommand(VSCodeCommandIds.viewSettings, () => {
    qwikiProvider?.showPage(Pages.settings);
  });

  const showSavedWikisCommand = commands.registerCommand(VSCodeCommandIds.viewSavedWikis, () => {
    qwikiProvider?.showPage(Pages.savedWikis);
  });

  const showErrorHistoryCommand = commands.registerCommand(
    VSCodeCommandIds.viewErrorHistory,
    () => {
      qwikiProvider?.showPage(Pages.errorHistory);
    },
  );

  const createQuickWikiCommand = commands.registerCommand(VSCodeCommandIds.createQuickWiki, () => {
    qwikiProvider?.createWikiFromEditorSelection();
  });

  context.subscriptions.push(
    showQwikiCommand,
    showSettingsCommand,
    showSavedWikisCommand,
    showErrorHistoryCommand,
    createQuickWikiCommand,
  );
}

export async function deactivate(): Promise<void> {
  if (qwikiProvider) {
    await qwikiProvider.dispose();
    qwikiProvider = undefined;
  }
}
