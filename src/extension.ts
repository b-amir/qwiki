import { ExtensionContext, StatusBarAlignment, window } from "vscode";
import { AppBootstrap } from "@/application/AppBootstrap";
import { VSCodeCommandIds, ServiceLimits } from "@/constants";
import { QwikiPanel } from "@/panels/QwikiPanel";

let appBootstrap: AppBootstrap | undefined;

export async function activate(context: ExtensionContext) {
  appBootstrap = new AppBootstrap(context);

  try {
    // Initialize critical services
    await appBootstrap.initialize();

    const qwikiPanel = new QwikiPanel(context.extensionUri, context, appBootstrap);

    // Register webview provider
    context.subscriptions.push(
      window.registerWebviewViewProvider(VSCodeCommandIds.wikiViewId, qwikiPanel)
    );

    // Initialize event handlers
    await appBootstrap.initializeEventHandlers();

    const statusBarItem = window.createStatusBarItem(
      StatusBarAlignment.Right,
      ServiceLimits.statusBarItemPriority
    );
    statusBarItem.command = VSCodeCommandIds.showCommands;
    statusBarItem.text = "Qwiki";
    statusBarItem.tooltip = "Click to open Qwiki commands";
    statusBarItem.show();
    
    // Set global access for event handlers
    const { setStatusBarItem } = await import("@/constants/GlobalState");
    setStatusBarItem(statusBarItem);
    
    context.subscriptions.push(statusBarItem);

  } catch (error) {
    console.error("Failed to activate Qwiki extension:", error);
    window.showErrorMessage("Qwiki failed to activate. Check console for details.");
  }
}

export async function deactivate(): Promise<void> {
  if (appBootstrap) {
    await appBootstrap.dispose();
    appBootstrap = undefined;
  }
}

