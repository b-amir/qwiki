import type { Container } from "@/container/Container";
import { WikiEventHandler } from "@/events/handlers/WikiEventHandler";
import type { LogMode } from "@/infrastructure/services/logging/LoggingService";
import type { ConfigurationManagerService } from "@/application/services/configuration/ConfigurationManagerService";
import type { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import type { LLMRegistry } from "@/llm";

export type CommandPaletteContext = {
  providerId?: string;
  providerName?: string;
  savedWikisCount?: number;
  loggingMode?: LogMode;
  hasActiveGeneration: boolean;
};

export type ResolveContainer = () => Container | undefined;

export const getInitialPaletteContext = (): CommandPaletteContext => ({
  hasActiveGeneration: WikiEventHandler.instance?.hasActiveGeneration() ?? false,
});

const collectContextData = async (
  container: Container,
  context: CommandPaletteContext,
): Promise<void> => {
  const tasks: Array<Promise<void>> = [];

  tasks.push(
    (async () => {
      try {
        const configurationManager = container.resolve(
          "configurationManager",
        ) as ConfigurationManagerService;
        const cachedProviderId = configurationManager.getCachedProviderId();
        let providerId: string | undefined =
          cachedProviderId !== null ? cachedProviderId : undefined;

        if (!providerId) {
          const globalConfig = await configurationManager.getGlobalConfig();
          providerId = globalConfig.defaultProviderId ?? undefined;
        }

        if (providerId) {
          context.providerId = providerId;
          try {
            const registry = (await container.resolveLazy("llmRegistry")) as
              | LLMRegistry
              | undefined;
            const provider = registry?.getProvider(providerId as any);
            context.providerName = provider?.name ?? providerId;
          } catch {
            context.providerName = providerId;
          }
        }
      } catch {}
    })(),
  );

  tasks.push(
    (async () => {
      try {
        const wikiStorage = container.resolve("wikiStorageService") as WikiStorageService;
        const savedWikis = await wikiStorage.getAllSavedWikis();
        context.savedWikisCount = savedWikis.length;
      } catch {}
    })(),
  );

  tasks.push(
    (async () => {
      try {
        const loggingService = container.resolve("loggingService") as { getMode(): LogMode };
        context.loggingMode = loggingService.getMode();
      } catch {}
    })(),
  );

  await Promise.allSettled(tasks);
};

export const fetchPaletteContext = async (
  resolveContainer?: ResolveContainer,
): Promise<CommandPaletteContext> => {
  const context = getInitialPaletteContext();

  if (!resolveContainer) {
    return context;
  }

  let container: Container | undefined;
  try {
    container = resolveContainer();
  } catch {
    return context;
  }

  if (!container) {
    return context;
  }

  await collectContextData(container, context);
  return context;
};
