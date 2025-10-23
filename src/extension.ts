import { ExtensionContext, window, commands } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";

export function activate(context: ExtensionContext) {
  // Register the webview view provider
  const provider = new HelloWorldPanel(context.extensionUri);
  
  context.subscriptions.push(
    window.registerWebviewViewProvider("qwiki.helloWorldView", provider)
  );

  // Create the show hello world command (optional, can be removed if not needed)
  const showHelloWorldCommand = commands.registerCommand("qwiki.helloWorld", () => {
    // This command will focus on the qwiki activity bar view
    commands.executeCommand("workbench.view.extension.qwiki");
  });

  // Add command to the extension context
  context.subscriptions.push(showHelloWorldCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
