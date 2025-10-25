import { ExtensionContext, window, commands } from "vscode";
import { QwikiPanel } from "./panels/QwikiPanel";

export function activate(context: ExtensionContext) {
  // Register the webview view provider
  const provider = new QwikiPanel(context.extensionUri, context);

  context.subscriptions.push(window.registerWebviewViewProvider("qwiki.wikiView", provider));

  // Create the show command
  const showQwikiCommand = commands.registerCommand("qwiki.show", () => {
    // Focus the Qwiki activity bar view
    commands.executeCommand("workbench.view.extension.qwiki");
  });

  const showSettingsCommand = commands.registerCommand("qwiki.viewSettings", () => {
    provider.showTab("settings");
  });

  // Add command to the extension context
  context.subscriptions.push(showQwikiCommand, showSettingsCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
