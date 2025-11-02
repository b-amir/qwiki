import { ExtensionContext, window, commands, StatusBarAlignment, TreeView } from "vscode";
import { QwikiPanel } from "./panels/QwikiPanel";
import { VSCodeCommandIds, Pages } from "./constants";
import { SelectProviderCommand } from "./application/commands/SelectProviderCommand";
import { SavedWikisTreeDataProvider } from "./views/SavedWikisTreeView";

let qwikiProvider: QwikiPanel | undefined;
let savedWikisTreeProvider: SavedWikisTreeDataProvider | undefined;
let savedWikisTreeView: TreeView<any> | undefined;

export function activate(context: ExtensionContext) {
  qwikiProvider = new QwikiPanel(context.extensionUri, context);

  context.subscriptions.push(
    window.registerWebviewViewProvider(VSCodeCommandIds.wikiViewId, qwikiProvider),
  );

  const initializeTreeView = async () => {
    try {
      const container = qwikiProvider?.getContainer?.();
      if (container) {
        const wikiStorage = container.resolve("wikiStorageService") as any;
        const eventBus = container.resolve("eventBus") as any;
        const loggingService = container.resolve("loggingService") as any;

        savedWikisTreeProvider = new SavedWikisTreeDataProvider(
          wikiStorage,
          eventBus,
          loggingService,
        );
        savedWikisTreeView = window.createTreeView("qwiki.savedWikis", {
          treeDataProvider: savedWikisTreeProvider,
        });
        context.subscriptions.push(savedWikisTreeView);
      }
    } catch (error) {}
  };

  setTimeout(() => {
    initializeTreeView().catch(() => {});
  }, 1000);

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

  const selectProviderCommand = commands.registerCommand(
    VSCodeCommandIds.selectProvider,
    async () => {
      try {
        const container = qwikiProvider?.getContainer?.();
        if (!container) {
          window.showErrorMessage(
            "Qwiki is not initialized yet. Please wait a moment and try again.",
          );
          return;
        }

        const llmRegistry = (await container.resolveLazy("llmRegistry")) as any;
        const apiKeyRepository = container.resolve("apiKeyRepository") as any;
        const configurationManager = container.resolve("configurationManager") as any;
        const loggingService = container.resolve("loggingService") as any;

        const command = new SelectProviderCommand(
          llmRegistry,
          apiKeyRepository,
          configurationManager,
          loggingService,
        );

        const selectedProviderId = await command.execute();
        if (selectedProviderId) {
          window.showInformationMessage(`Selected provider: ${selectedProviderId}`);
        }
      } catch (error) {
        window.showErrorMessage(
          `Failed to select provider: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
  );

  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = VSCodeCommandIds.showPanel;
  statusBarItem.text = "$(book) Qwiki";
  statusBarItem.tooltip = "Open Qwiki";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    showQwikiCommand,
    showSettingsCommand,
    showSavedWikisCommand,
    showErrorHistoryCommand,
    createQuickWikiCommand,
    selectProviderCommand,
  );
}

export async function deactivate(): Promise<void> {
  if (savedWikisTreeProvider) {
    savedWikisTreeProvider.dispose();
    savedWikisTreeProvider = undefined;
  }
  if (qwikiProvider) {
    await qwikiProvider.dispose();
    qwikiProvider = undefined;
  }
}
