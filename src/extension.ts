import { ExtensionContext, window, commands } from "vscode";
import { QwikiPanel } from "./panels/QwikiPanel";
import { VSCodeCommandIds, Pages } from "./constants";

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

  const showSavedWikisCommand = commands.registerCommand(VSCodeCommandIds.viewSavedWikis, () => {
    provider.showPage(Pages.savedWikis);
  });

  const showErrorHistoryCommand = commands.registerCommand(
    VSCodeCommandIds.viewErrorHistory,
    () => {
      provider.showPage(Pages.errorHistory);
    },
  );

  const createQuickWikiCommand = commands.registerCommand(VSCodeCommandIds.createQuickWiki, () => {
    provider.createWikiFromEditorSelection();
  });

  const createWikiAggregationCommand = commands.registerCommand(
    VSCodeCommandIds.createWikiAggregation,
    () => {
      provider.showWikiAggregation();
    },
  );

  const updateReadmeCommand = commands.registerCommand(VSCodeCommandIds.updateReadme, () => {
    provider.showReadmeUpdate();
  });

  context.subscriptions.push(
    showQwikiCommand,
    showSettingsCommand,
    showSavedWikisCommand,
    showErrorHistoryCommand,
    createQuickWikiCommand,
    createWikiAggregationCommand,
    updateReadmeCommand,
  );
}

export function deactivate() {}
