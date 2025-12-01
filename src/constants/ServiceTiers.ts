import type {
  ServiceTier,
  CommandRequirements,
} from "@/infrastructure/services/ServiceReadinessManager";

export interface ServiceTierConfig {
  tier: ServiceTier;
  maxInitTime: number;
  requiredFor: string[];
}

/**
 * Service tier classifications for MVP
 * - critical: Must complete before UI is usable (< 500ms total)
 * - background: Initialize async, don't block UI (< 30s)
 * - optional: Initialize on-demand (deferred to later iteration)
 */
export const SERVICE_TIERS: Record<string, ServiceTierConfig> = {
  // CRITICAL: Must complete before UI is usable (< 500ms total)
  loggingService: {
    tier: "critical",
    maxInitTime: 10,
    requiredFor: ["*"],
  },
  eventBus: {
    tier: "critical",
    maxInitTime: 10,
    requiredFor: ["*"],
  },
  configurationManager: {
    tier: "critical",
    maxInitTime: 200,
    requiredFor: ["getProviders", "selectProvider", "getSettings"],
  },
  messageBus: {
    tier: "critical",
    maxInitTime: 50,
    requiredFor: ["*"],
  },
  commandRegistry: {
    tier: "critical",
    maxInitTime: 100,
    requiredFor: ["*"],
  },
  taskScheduler: {
    tier: "critical",
    maxInitTime: 50,
    requiredFor: ["contextCache"],
  },

  // BACKGROUND: Initialize async, don't block UI (< 30s)
  projectIndexService: {
    tier: "background",
    maxInitTime: 30000,
    requiredFor: ["generateWiki"],
  },
  providerHealthService: {
    tier: "background",
    maxInitTime: 5000,
    requiredFor: [],
  },
  contextIntelligenceService: {
    tier: "background",
    maxInitTime: 10000,
    requiredFor: ["generateWiki"],
  },
  contextCache: {
    tier: "background",
    maxInitTime: 5000,
    requiredFor: ["generateWiki"],
  },
};

/**
 * Command requirements for MVP
 * Defines which services are required for each command
 */
export const COMMAND_REQUIREMENTS: CommandRequirements[] = [
  // Navigation commands (no service dependencies)
  {
    commandId: "navigateToHome",
    requiredServices: [],
    optionalServices: [],
  },
  {
    commandId: "navigateToSettings",
    requiredServices: [],
    optionalServices: [],
  },
  {
    commandId: "navigateToProviders",
    requiredServices: [],
    optionalServices: [],
  },

  // Provider commands (require configurationManager)
  {
    commandId: "getProviders",
    requiredServices: ["configurationManager"],
    optionalServices: [],
  },
  {
    commandId: "selectProvider",
    requiredServices: ["configurationManager"],
    optionalServices: [],
  },

  // Settings commands (require configurationManager)
  {
    commandId: "getSettings",
    requiredServices: ["configurationManager"],
    optionalServices: [],
  },
  {
    commandId: "updateSettings",
    requiredServices: ["configurationManager"],
    optionalServices: [],
  },

  // Wiki generation (requires background services)
  {
    commandId: "generateWiki",
    requiredServices: ["projectIndexService", "contextIntelligenceService", "contextCache"],
    optionalServices: [],
    fallbackBehavior: "degrade",
  },
];

/**
 * Command timeouts in milliseconds
 */
export const COMMAND_TIMEOUTS: Record<string, number> = {
  generateWiki: 120000, // 120s - context analysis (up to 80s) + LLM generation (20-40s) + buffer
  updateReadme: 120000, // 120s - README generation (60-90s for large wiki sets) + LLM response + buffer
  getProviders: 5000, // 5s - should be instant from cache
  selectProvider: 5000, // 5s
  getSettings: 5000, // 5s
  updateSettings: 5000, // 5s
  default: 10000, // 10s
};

/**
 * Generation timeouts in milliseconds (separate from command timeouts)
 * These are for actual LLM generation operations
 */
export const GENERATION_TIMEOUTS: Record<string, number> = {
  generateWiki: 180000, // 180s - separate from command timeout
  updateReadme: 180000, // 180s
  default: 120000, // 120s
};

/**
 * Commands that can execute immediately without waiting for any services
 */
export const IMMEDIATE_COMMANDS = new Set([
  "frontendLog",
  "webviewReady",
  "getEnvironmentStatus",
  "openFile",
  "navigateToHome",
  "navigateToSettings",
  "navigateToProviders",
]);
