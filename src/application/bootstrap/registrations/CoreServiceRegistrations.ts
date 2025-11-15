import { Container } from "@/container/Container";
import { LoggingService } from "@/infrastructure/services";
import { CommandRegistry } from "@/application/CommandRegistry";
import { SelectionService } from "@/application/services/core/SelectionService";
import { WikiService } from "@/application/services/core/WikiService";
import { CachedWikiService } from "@/application/services/core/CachedWikiService";
import { MessageBusService } from "@/application/services/core/MessageBusService";
import { WikiStorageService } from "@/application/services/storage/WikiStorageService";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import { GenerationCacheService } from "@/infrastructure/services/caching/GenerationCacheService";
import { RequestBatchingService } from "@/infrastructure/services/optimization/RequestBatchingService";
import { DebouncingService } from "@/infrastructure/services/optimization/DebouncingService";
import { BackgroundProcessingService } from "@/infrastructure/services/optimization/BackgroundProcessingService";
import { MemoryOptimizationService } from "@/infrastructure/services/optimization/MemoryOptimizationService";
import { PerformanceMonitorService } from "@/infrastructure/services/performance/PerformanceMonitorService";
import { ContextIntelligenceService } from "@/application/services/context/ContextIntelligenceService";
import { ContextCompressionService } from "@/application/services/context/ContextCompressionService";
import { AdvancedPromptService } from "@/application/services/prompts/AdvancedPromptService";
import { CachedProjectContextService } from "@/application/services/context/project/CachedProjectContextService";
import { LanguageServerIntegrationService } from "@/infrastructure/services/integration/LanguageServerIntegrationService";
import { LLMRegistry } from "@/llm";
import { SelectionEventHandler } from "@/events/handlers/SelectionEventHandler";
import { WikiEventHandler } from "@/events/handlers/WikiEventHandler";
import { WikiWatcherService } from "@/infrastructure/services/storage/WikiWatcherService";
import type { ExtensionContext } from "vscode";
import { GitChangeDetectionService } from "@/infrastructure/services/integration/GitChangeDetectionService";
import { ProjectContextService } from "@/application/services/context/project/ProjectContextService";
import { ProviderValidationService } from "@/infrastructure/services/providers/ProviderValidationService";

export function registerCoreServices(
  container: Container,
  context: ExtensionContext,
  loggingService: LoggingService,
): void {
  container.register("selectionService", () => new SelectionService());

  container.register("commandRegistry", () => new CommandRegistry(loggingService));

  container.register(
    "wikiStorageService",
    () =>
      new WikiStorageService(
        container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        loggingService,
      ),
  );

  container.registerLazy("llmRegistry", async () => {
    const configurationRepository = container.resolve(
      "configurationRepository",
    ) as import("../../../domain/repositories/ConfigurationRepository").ConfigurationRepository;
    const getSetting = async (key: string) => await configurationRepository.get<string>(key);
    return new LLMRegistry(
      container.resolve("secrets"),
      container.resolve("errorRecoveryService"),
      container.resolve("errorLoggingService"),
      container.resolve("configurationManager"),
      container.resolve("rateLimiterService"),
      getSetting,
    );
  });

  container.registerLazy(
    "wikiService",
    async () =>
      new WikiService(
        await container.resolveLazy("llmRegistry"),
        container.resolve("generationCacheService") as GenerationCacheService,
        container.resolve("requestBatchingService") as RequestBatchingService,
        container.resolve("debouncingService") as DebouncingService,
        container.resolve("backgroundProcessingService") as BackgroundProcessingService,
        container.resolve("memoryOptimizationService") as MemoryOptimizationService,
        (await container.resolveLazy("contextIntelligenceService")) as ContextIntelligenceService,
        container.resolve("contextCompressionService") as ContextCompressionService,
        (await container.resolveLazy("advancedPromptService")) as AdvancedPromptService,
        container.resolve("performanceMonitor") as PerformanceMonitorService,
        (await container.resolveLazy("cachedProjectContextService")) as CachedProjectContextService,
        loggingService,
        (await container.resolveLazy(
          "languageServerIntegrationService",
        )) as LanguageServerIntegrationService,
        container.resolve("promptQualityService"),
      ),
  );

  container.registerLazy(
    "cachedWikiService",
    async () =>
      new CachedWikiService(
        await container.resolveLazy("llmRegistry"),
        container.resolve("cachingService"),
        container.resolve("performanceMonitor"),
        container.resolve("generationCacheService") as GenerationCacheService,
        container.resolve("requestBatchingService") as RequestBatchingService,
        container.resolve("debouncingService") as DebouncingService,
        container.resolve("backgroundProcessingService") as BackgroundProcessingService,
        container.resolve("memoryOptimizationService") as MemoryOptimizationService,
      ),
  );

  container.register(
    "selectionEventHandler",
    () => new SelectionEventHandler(container.resolve("eventBus")),
  );

  container.registerLazy(
    "wikiEventHandler",
    async () =>
      new WikiEventHandler(
        container.resolve("eventBus"),
        await container.resolveLazy("wikiService"),
        await container.resolveLazy("cachedWikiService"),
        (await container.resolveLazy("projectContextService")) as ProjectContextService,
        container.resolve("errorRecoveryService"),
        container.resolve("errorLoggingService"),
        await container.resolveLazy("providerValidationService"),
        loggingService,
      ),
  );

  container.register(
    "wikiWatcherService",
    () =>
      new WikiWatcherService(
        container.resolve("eventBus"),
        context,
        loggingService,
        container.resolve("debouncingService") as DebouncingService,
        container.resolve("gitChangeDetectionService") as GitChangeDetectionService | undefined,
      ),
  );
}
