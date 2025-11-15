import type { CommandGroup, CommandMetadata } from "@/application/CommandRegistry";
import { CommandIds } from "@/constants";
import { COMMAND_TIMEOUTS, COMMAND_REQUIREMENTS } from "@/constants/ServiceTiers";

export function getCommandMetadata(commandId: string): CommandMetadata | undefined {
  return COMMAND_METADATA.get(commandId);
}

export function getCommandGroup(commandId: string): CommandGroup | undefined {
  const metadata = COMMAND_METADATA.get(commandId);
  return metadata?.group;
}

export function getAllCommandMetadata(): CommandMetadata[] {
  return Array.from(COMMAND_METADATA.values());
}

export function getCommandsByGroup(group: CommandGroup): CommandMetadata[] {
  return Array.from(COMMAND_METADATA.values()).filter((meta) => meta.group === group);
}

const COMMAND_METADATA = new Map<string, CommandMetadata>([
  // Core commands
  [
    CommandIds.generateWiki,
    {
      id: CommandIds.generateWiki,
      group: "core",
      requiresReadiness: getRequiredServices(CommandIds.generateWiki),
      timeout: COMMAND_TIMEOUTS[CommandIds.generateWiki],
      description: "Generate a wiki from the current selection or prompt",
    },
  ],
  [
    CommandIds.getSelection,
    {
      id: CommandIds.getSelection,
      group: "core",
      description: "Get the current editor selection",
    },
  ],
  [
    CommandIds.getRelated,
    {
      id: CommandIds.getRelated,
      group: "core",
      description: "Get related files for context",
    },
  ],

  // Provider commands
  [
    CommandIds.getProviders,
    {
      id: CommandIds.getProviders,
      group: "providers",
      requiresReadiness: getRequiredServices(CommandIds.getProviders),
      timeout: COMMAND_TIMEOUTS[CommandIds.getProviders],
      description: "Get all available LLM providers",
    },
  ],
  [
    CommandIds.saveApiKey,
    {
      id: CommandIds.saveApiKey,
      group: "providers",
      requiresReadiness: getRequiredServices("selectProvider"),
      timeout: COMMAND_TIMEOUTS.selectProvider,
      description: "Save an API key for a provider",
    },
  ],
  [
    CommandIds.deleteApiKey,
    {
      id: CommandIds.deleteApiKey,
      group: "providers",
      requiresReadiness: getRequiredServices("selectProvider"),
      timeout: COMMAND_TIMEOUTS.selectProvider,
      description: "Delete an API key for a provider",
    },
  ],
  [
    CommandIds.getApiKeys,
    {
      id: CommandIds.getApiKeys,
      group: "providers",
      requiresReadiness: getRequiredServices("selectProvider"),
      timeout: COMMAND_TIMEOUTS.selectProvider,
      description: "Get all saved API keys",
    },
  ],
  [
    CommandIds.getProviderConfigs,
    {
      id: CommandIds.getProviderConfigs,
      group: "providers",
      requiresReadiness: getRequiredServices(CommandIds.getProviders),
      timeout: COMMAND_TIMEOUTS[CommandIds.getProviders],
      description: "Get provider configurations",
    },
  ],
  [
    CommandIds.getProviderCapabilities,
    {
      id: CommandIds.getProviderCapabilities,
      group: "providers",
      requiresReadiness: getRequiredServices(CommandIds.getProviders),
      timeout: COMMAND_TIMEOUTS[CommandIds.getProviders],
      description: "Get provider capabilities",
    },
  ],
  [
    CommandIds.getProviderHealth,
    {
      id: CommandIds.getProviderHealth,
      group: "providers",
      description: "Get provider health status",
    },
  ],
  [
    CommandIds.getProviderPerformance,
    {
      id: CommandIds.getProviderPerformance,
      group: "providers",
      description: "Get provider performance metrics",
    },
  ],
  [
    CommandIds.validateApiKeys,
    {
      id: CommandIds.validateApiKeys,
      group: "providers",
      description: "Validate configured API keys",
    },
  ],
  [
    CommandIds.validateApiKeyHealth,
    {
      id: CommandIds.validateApiKeyHealth,
      group: "providers",
      description: "Perform live API key health check",
    },
  ],

  // Configuration commands
  [
    CommandIds.getConfiguration,
    {
      id: CommandIds.getConfiguration,
      group: "configuration",
      requiresReadiness: getRequiredServices("getSettings"),
      timeout: COMMAND_TIMEOUTS.getSettings,
      description: "Get current configuration",
    },
  ],
  [
    CommandIds.updateConfiguration,
    {
      id: CommandIds.updateConfiguration,
      group: "configuration",
      requiresReadiness: getRequiredServices("updateSettings"),
      timeout: COMMAND_TIMEOUTS.updateSettings,
      description: "Update configuration",
    },
  ],
  [
    CommandIds.validateConfiguration,
    {
      id: CommandIds.validateConfiguration,
      group: "configuration",
      requiresReadiness: getRequiredServices("updateSettings"),
      timeout: COMMAND_TIMEOUTS.updateSettings,
      description: "Validate configuration",
    },
  ],
  [
    CommandIds.applyConfigurationTemplate,
    {
      id: CommandIds.applyConfigurationTemplate,
      group: "configuration",
      requiresReadiness: getRequiredServices("updateSettings"),
      timeout: COMMAND_TIMEOUTS.updateSettings,
      description: "Apply configuration template",
    },
  ],
  [
    CommandIds.getConfigurationTemplates,
    {
      id: CommandIds.getConfigurationTemplates,
      group: "configuration",
      requiresReadiness: getRequiredServices("getSettings"),
      timeout: COMMAND_TIMEOUTS.getSettings,
      description: "Get available configuration templates",
    },
  ],
  [
    CommandIds.createConfigurationBackup,
    {
      id: CommandIds.createConfigurationBackup,
      group: "configuration",
      requiresReadiness: getRequiredServices("updateSettings"),
      timeout: COMMAND_TIMEOUTS.updateSettings,
      description: "Create configuration backup",
    },
  ],
  [
    CommandIds.getConfigurationBackups,
    {
      id: CommandIds.getConfigurationBackups,
      group: "configuration",
      requiresReadiness: getRequiredServices("getSettings"),
      timeout: COMMAND_TIMEOUTS.getSettings,
      description: "Get configuration backups",
    },
  ],

  // Wiki commands
  [
    CommandIds.saveWiki,
    {
      id: CommandIds.saveWiki,
      group: "wikis",
      description: "Save generated wiki",
    },
  ],
  [
    CommandIds.getSavedWikis,
    {
      id: CommandIds.getSavedWikis,
      group: "wikis",
      description: "Get all saved wikis",
    },
  ],
  [
    CommandIds.deleteWiki,
    {
      id: CommandIds.deleteWiki,
      group: "wikis",
      description: "Delete saved wiki",
    },
  ],

  // Readme commands
  [
    CommandIds.updateReadme,
    {
      id: CommandIds.updateReadme,
      group: "readme",
      description: "Update README from wikis",
    },
  ],
  [
    CommandIds.showReadmeDiff,
    {
      id: CommandIds.showReadmeDiff,
      group: "readme",
      description: "Show README diff before applying",
    },
  ],
  [
    CommandIds.undoReadme,
    {
      id: CommandIds.undoReadme,
      group: "readme",
      description: "Undo last README update",
    },
  ],
  [
    CommandIds.checkReadmeBackupState,
    {
      id: CommandIds.checkReadmeBackupState,
      group: "readme",
      description: "Check README backup state",
    },
  ],

  // Utility commands
  [
    CommandIds.openFile,
    {
      id: CommandIds.openFile,
      group: "utilities",
      description: "Open file in editor",
    },
  ],
  [
    CommandIds.openExternal,
    {
      id: CommandIds.openExternal,
      group: "utilities",
      description: "Open external URL",
    },
  ],
  [
    CommandIds.saveSetting,
    {
      id: CommandIds.saveSetting,
      group: "utilities",
      description: "Save a setting",
    },
  ],
  [
    CommandIds.toggleOutputChannel,
    {
      id: CommandIds.toggleOutputChannel,
      group: "utilities",
      description: "Toggle output channel visibility",
    },
  ],
]);

function getRequiredServices(commandId: string): string[] | undefined {
  const requirement = COMMAND_REQUIREMENTS.find((req) => req.commandId === commandId);
  return requirement?.requiredServices.length ? requirement.requiredServices : undefined;
}
