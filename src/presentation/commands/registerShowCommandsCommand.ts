import {
  commands,
  window,
  QuickInputButtons,
  ThemeIcon,
  type Disposable,
  type QuickInputButton,
} from "vscode";
import { CommandPaletteText, VSCodeCommandIds } from "../../constants";
import {
  fetchPaletteContext,
  getInitialPaletteContext,
  type ResolveContainer,
} from "./getCommandPaletteContext";
import {
  applySelection,
  buildCommandItems,
  type CommandQuickPickItem,
} from "./commandPaletteItems";
import { createLogger } from "../../infrastructure/services/LoggingService";

let autoReopenAttempts = 0;
let lastInvocationToken = 0;
const logger = createLogger("ShowCommandsQuickPick");

const refreshButton: QuickInputButton = {
  iconPath: new ThemeIcon("refresh"),
  tooltip: CommandPaletteText.refreshTooltip,
};

export const registerShowCommandsCommand = (resolveContainer?: ResolveContainer) =>
  commands.registerCommand(VSCodeCommandIds.showCommands, () => {
    const invocationToken = ++lastInvocationToken;
    const quickPick = window.createQuickPick<CommandQuickPickItem>();
    quickPick.title = CommandPaletteText.title;
    quickPick.placeholder = CommandPaletteText.placeholder;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.ignoreFocusOut = true;
    quickPick.canSelectMany = false;
    quickPick.buttons = [QuickInputButtons.Back, refreshButton];

    const disposables: Disposable[] = [];
    let isDisposed = false;
    let shouldAutoReopen = true;
    const openedAt = Date.now();
    logger.debug("QuickPick opened", {
      invocationToken,
      autoReopenAttempts,
    });
    const setBusyState = (isBusy: boolean) => {
      quickPick.busy = isBusy;
      quickPick.placeholder = isBusy
        ? CommandPaletteText.busyMessage
        : CommandPaletteText.placeholder;
    };

    const updateItems = async (preserveSelection: boolean) => {
      if (isDisposed) {
        return;
      }
      const previousSelection = preserveSelection
        ? quickPick.selectedItems[0]?.commandId
        : undefined;
      setBusyState(true);
      try {
        const context = await fetchPaletteContext(resolveContainer);
        if (isDisposed) {
          logger.debug("QuickPick disposed before context applied", {
            invocationToken,
          });
          return;
        }
        quickPick.items = buildCommandItems(context);
        applySelection(quickPick, previousSelection);
        logger.debug("QuickPick items updated", {
          invocationToken,
          itemCount: quickPick.items.length,
          preservedSelection: Boolean(previousSelection),
        });
      } catch (error) {
        logger.warn("QuickPick context fetch failed", {
          invocationToken,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { message: String(error) },
        });
        if (!isDisposed) {
          quickPick.items = buildCommandItems(getInitialPaletteContext());
          applySelection(quickPick);
        }
      } finally {
        if (!isDisposed) {
          setBusyState(false);
        }
      }
    };

    quickPick.items = buildCommandItems(getInitialPaletteContext());
    applySelection(quickPick);
    disposables.push(
      quickPick.onDidAccept(() => {
        const [selected] = quickPick.selectedItems;
        if (!selected?.commandId) {
          logger.debug("QuickPick accept ignored due to missing selection", {
            invocationToken,
          });
          return;
        }
        shouldAutoReopen = false;
        autoReopenAttempts = 0;
        logger.debug("QuickPick accepted", {
          invocationToken,
          selectedCommand: selected?.commandId,
        });
        quickPick.hide();
        commands.executeCommand(selected.commandId);
      }),
      quickPick.onDidHide(() => {
        isDisposed = true;
        quickPick.dispose();
        disposables.forEach((disposable) => disposable.dispose());

        const closedQuickly =
          Date.now() - openedAt <= CommandPaletteText.behavior.autoReopenWindowMs;

        logger.debug("QuickPick closed", {
          invocationToken,
          closedQuickly,
          shouldAutoReopen,
          autoReopenAttempts,
        });

        if (
          shouldAutoReopen &&
          closedQuickly &&
          autoReopenAttempts < CommandPaletteText.behavior.autoReopenLimit
        ) {
          autoReopenAttempts += 1;
          setTimeout(() => {
            if (invocationToken === lastInvocationToken) {
              logger.debug("QuickPick auto reopen triggered", {
                invocationToken,
                nextInvocationToken: lastInvocationToken + 1,
                autoReopenAttempts,
              });
              commands.executeCommand(VSCodeCommandIds.showCommands);
            }
          }, CommandPaletteText.behavior.autoReopenDelayMs);
        } else {
          autoReopenAttempts = 0;
        }
      }),
      quickPick.onDidTriggerButton((button) => {
        if (button === QuickInputButtons.Back) {
          shouldAutoReopen = false;
          autoReopenAttempts = 0;
          logger.debug("QuickPick back button pressed", { invocationToken });
          quickPick.hide();
          return;
        }
        if (button === refreshButton) {
          logger.debug("QuickPick refresh initiated", { invocationToken });
          void updateItems(true);
        }
      }),
    );
    quickPick.show();
    void updateItems(true);
  });
