import type { QuickPick, QuickPickItem } from "vscode";
import { VSCodeCommandIds, CommandPaletteText } from "../../constants";
import type { CommandPaletteContext } from "./getCommandPaletteContext";

type CommandDefinition = {
  key: string;
  commandId: string;
  label: string;
  description: string;
  buildDescription?: (baseDescription: string, context?: CommandPaletteContext) => string;
};

export type CommandQuickPickItem = QuickPickItem & {
  commandId: string;
  commandKey: string;
};

type CommandKey = keyof typeof CommandPaletteText.commands;

const appendContext = (base: string, extra?: string): string =>
  extra ? `${base} • ${extra}` : base;

const savedWikisSummary = (context?: CommandPaletteContext): string | undefined => {
  if (!context || typeof context.savedWikisCount !== "number") {
    return undefined;
  }
  if (context.savedWikisCount > 0) {
    return `${context.savedWikisCount} ${CommandPaletteText.dynamic.savedWikisCountSuffix}`;
  }
  return CommandPaletteText.dynamic.savedWikisNone;
};

const providerSummary = (context?: CommandPaletteContext): string | undefined => {
  if (context?.providerName) {
    return `${CommandPaletteText.dynamic.providerLabel}: ${context.providerName}`;
  }
  if (context?.providerId) {
    return `${CommandPaletteText.dynamic.providerLabel}: ${context.providerId}`;
  }
  return CommandPaletteText.dynamic.providerUnknown;
};

const loggingSummary = (context?: CommandPaletteContext): string =>
  `${CommandPaletteText.dynamic.loggingModeLabel}: ${context?.loggingMode ?? "normal"}`;

const createDefinition = (
  key: CommandKey,
  commandId: string,
  options: Partial<Pick<CommandDefinition, "buildDescription">> = {},
): CommandDefinition => {
  const entry = CommandPaletteText.commands[key];
  return {
    key: entry.key,
    commandId,
    label: entry.label,
    description: entry.description,
    buildDescription: options.buildDescription,
  };
};

const commandDefinitions: CommandDefinition[] = [
  createDefinition("showPanel", VSCodeCommandIds.showPanel),
  createDefinition("createQuickWiki", VSCodeCommandIds.createQuickWiki),
  createDefinition("viewSavedWikis", VSCodeCommandIds.viewSavedWikis, {
    buildDescription: (base, context) => appendContext(base, savedWikisSummary(context)),
  }),
  createDefinition("selectProvider", VSCodeCommandIds.selectProvider, {
    buildDescription: (base, context) => appendContext(base, providerSummary(context)),
  }),
  createDefinition("viewErrorHistory", VSCodeCommandIds.viewErrorHistory),
  createDefinition("viewSettings", VSCodeCommandIds.viewSettings),
  createDefinition("toggleOutputChannel", VSCodeCommandIds.toggleOutputChannel),
  createDefinition("toggleLoggingMode", VSCodeCommandIds.toggleLoggingMode, {
    buildDescription: (base, context) => appendContext(base, loggingSummary(context)),
  }),
];

const cancelCommandDefinition = createDefinition(
  "cancelActiveRequest",
  VSCodeCommandIds.cancelActiveRequest,
);

export const buildCommandItems = (context?: CommandPaletteContext): CommandQuickPickItem[] => {
  const items = commandDefinitions.map((definition) => {
    const description = definition.buildDescription
      ? definition.buildDescription(definition.description, context)
      : definition.description;
    return {
      label: definition.label,
      description,
      commandId: definition.commandId,
      commandKey: definition.key,
    };
  });

  if (context?.hasActiveGeneration) {
    items.push({
      label: cancelCommandDefinition.label,
      description: cancelCommandDefinition.buildDescription
        ? cancelCommandDefinition.buildDescription(cancelCommandDefinition.description, context)
        : cancelCommandDefinition.description,
      commandId: cancelCommandDefinition.commandId,
      commandKey: cancelCommandDefinition.key,
    });
  }

  return items;
};

export const applySelection = (
  quickPick: QuickPick<CommandQuickPickItem>,
  preferredCommandId?: string,
) => {
  if (preferredCommandId) {
    const matchingItem = quickPick.items.find((item) => item.commandId === preferredCommandId);
    if (matchingItem) {
      quickPick.selectedItems = [matchingItem];
      return;
    }
  }

  const defaultKey = CommandPaletteText.defaultSelection as CommandKey | null;
  if (defaultKey) {
    const defaultItem = quickPick.items.find((item) => item.commandKey === defaultKey);
    if (defaultItem) {
      quickPick.selectedItems = [defaultItem];
    }
  }
};
