import {
  ExtensionContext,
  window,
  commands,
  StatusBarAlignment,
  TreeView,
  StatusBarItem,
} from "vscode";
import { QwikiPanel } from "./panels/QwikiPanel";
import { VSCodeCommandIds, Pages, ServiceLimits } from "./constants";
import { SelectProviderCommand } from "./application/commands/SelectProviderCommand";
import { SavedWikisTreeDataProvider } from "./views/SavedWikisTreeView";
import { WikiEventHandler } from "./events/handlers/WikiEventHandler";

let qwikiProvider: QwikiPanel | undefined;
let savedWikisTreeProvider: SavedWikisTreeDataProvider | undefined;
let savedWikisTreeView: TreeView<any> | undefined;

export let qwikiStatusBarItem: StatusBarItem | null = null;

export const HAS_ACTIVE_GENERATION_CONTEXT = "qwiki.hasActiveGeneration";

export function activate(context: ExtensionContext) {
  commands.executeCommand("setContext", HAS_ACTIVE_GENERATION_CONTEXT, false);

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
  }, ServiceLimits.treeViewInitializationDelay);

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

  qwikiStatusBarItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    ServiceLimits.statusBarItemPriority,
  );
  qwikiStatusBarItem.command = VSCodeCommandIds.showCommands;
  qwikiStatusBarItem.text = "Qwiki";
  qwikiStatusBarItem.tooltip = "Click to open Qwiki commands";
  qwikiStatusBarItem.show();
  context.subscriptions.push(qwikiStatusBarItem);

  const showCommandsCommand = commands.registerCommand(VSCodeCommandIds.showCommands, async () => {
    const qwikiCommands: Array<{ label: string; command: string; description: string }> = [
      {
        label: "Show Panel",
        command: VSCodeCommandIds.showPanel,
        description: "Open Qwiki panel",
      },
      {
        label: "Create a quick wiki!",
        command: VSCodeCommandIds.createQuickWiki,
        description: "Generate wiki from selected code",
      },
      {
        label: "Saved Wikis",
        command: VSCodeCommandIds.viewSavedWikis,
        description: "View saved wikis",
      },
      {
        label: "Select Provider",
        command: VSCodeCommandIds.selectProvider,
        description: "Select LLM provider",
      },
      {
        label: "Error History",
        command: VSCodeCommandIds.viewErrorHistory,
        description: "View error history",
      },
      {
        label: "Settings",
        command: VSCodeCommandIds.viewSettings,
        description: "Open Qwiki settings",
      },
    ];

    if (WikiEventHandler.instance?.hasActiveGeneration()) {
      qwikiCommands.push({
        label: "Cancel Active Request",
        command: VSCodeCommandIds.cancelActiveRequest,
        description: "Cancel active wiki generation",
      });
    }

    const selected = await window.showQuickPick(qwikiCommands, {
      placeHolder: "Select a Qwiki command...",
    });

    if (selected) {
      commands.executeCommand(selected.command);
    }
  });

  const cancelGenerationCommand = commands.registerCommand(
    VSCodeCommandIds.cancelGeneration,
    () => {
      if (WikiEventHandler.instance) {
        WikiEventHandler.instance.cancelActiveGeneration();
      }
    },
  );

  const cancelActiveRequestCommand = commands.registerCommand(
    VSCodeCommandIds.cancelActiveRequest,
    () => {
      if (WikiEventHandler.instance) {
        WikiEventHandler.instance.cancelActiveGeneration();
        window.showInformationMessage("Qwiki: Generation cancelled");
      } else {
        window.showInformationMessage("Qwiki: No active generation to cancel");
      }
    },
  );

  context.subscriptions.push(
    showQwikiCommand,
    showSettingsCommand,
    showSavedWikisCommand,
    showErrorHistoryCommand,
    createQuickWikiCommand,
    selectProviderCommand,
    showCommandsCommand,
    cancelGenerationCommand,
    cancelActiveRequestCommand,
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
