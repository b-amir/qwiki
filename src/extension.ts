import { ExtensionContext, window, commands } from "vscode";
import { QwikiPanel } from "./panels/QwikiPanel";

export function activate(context: ExtensionContext) {
  const provider = new QwikiPanel(context.extensionUri, context);

  context.subscriptions.push(window.registerWebviewViewProvider("qwiki.wikiView", provider));

  const showQwikiCommand = commands.registerCommand("qwiki.show", () => {
    commands.executeCommand("workbench.view.extension.qwiki");
  });

  const showSettingsCommand = commands.registerCommand("qwiki.viewSettings", () => {
    provider.showPage("settings");
  });

  const createQuickWikiCommand = commands.registerCommand("qwiki.createQuickWiki", () => {
    provider.createWikiFromEditorSelection();
  });

  context.subscriptions.push(showQwikiCommand, showSettingsCommand, createQuickWikiCommand);
}

export function deactivate() {}
