import { Container } from "@/container/Container";
import { LoggingService } from "@/infrastructure/services";
import {
  ReadmeUpdateService,
  ReadmeBackupService,
  ReadmeFileService,
  ReadmeDiffService,
  ReadmeCacheService,
  ReadmeSyncTrackerService,
  ReadmeStateDetectionService,
  ReadmeContentAnalysisService,
  ReadmePromptBuilderService,
  ReadmePromptOptimizationService,
  WikiSummarizationService,
  WikiStorageService,
  ProjectContextService,
  ProjectTypeDetectionService,
} from "../../services";
import { VSCodeFileSystemService } from "@/infrastructure/services";
import { VSCodeDiffService } from "@/infrastructure/services";
import { CachingService } from "@/infrastructure/services";
import { GitChangeDetectionService } from "@/infrastructure/services";
import { LLMRegistry } from "@/llm";

export function registerReadmeServices(container: Container, loggingService: LoggingService): void {
  container.register(
    "wikiSummarizationService",
    () => new WikiSummarizationService(loggingService),
  );

  container.register(
    "readmeContentAnalysisService",
    () => new ReadmeContentAnalysisService(loggingService),
  );

  container.register(
    "readmeStateDetectionService",
    () =>
      new ReadmeStateDetectionService(
        container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        container.resolve("gitChangeDetectionService") as GitChangeDetectionService,
        loggingService,
      ),
  );

  container.register(
    "readmeBackupService",
    () =>
      new ReadmeBackupService(
        container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        loggingService,
        container.resolve("eventBus"),
      ),
  );

  container.register(
    "readmeFileService",
    () =>
      new ReadmeFileService(
        container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        loggingService,
      ),
  );

  container.registerLazy("readmePromptBuilderService", async () => {
    return new ReadmePromptBuilderService(
      container.resolve("wikiSummarizationService") as WikiSummarizationService,
      (await container.resolveLazy("projectContextService")) as ProjectContextService,
      (await container.resolveLazy("projectTypeDetectionService")) as ProjectTypeDetectionService,
      loggingService,
    );
  });

  container.register("readmeDiffService", () => new ReadmeDiffService(loggingService));

  container.register("vscodeDiffService", () => new VSCodeDiffService(loggingService));

  container.register(
    "readmeSyncTrackerService",
    () =>
      new ReadmeSyncTrackerService(
        container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        loggingService,
        container.resolve("eventBus"),
      ),
  );

  container.register(
    "readmeCacheService",
    () =>
      new ReadmeCacheService(container.resolve("cachingService") as CachingService, loggingService),
  );

  container.registerLazy(
    "readmePromptOptimizationService",
    async () =>
      new ReadmePromptOptimizationService(
        await container.resolveLazy("llmRegistry"),
        loggingService,
      ),
  );

  container.registerLazy(
    "readmeUpdateService",
    async () =>
      new ReadmeUpdateService(
        container.resolve("wikiStorageService") as WikiStorageService,
        await container.resolveLazy("llmRegistry"),
        (await container.resolveLazy(
          "readmePromptOptimizationService",
        )) as ReadmePromptOptimizationService,
        (await container.resolveLazy("readmePromptBuilderService")) as ReadmePromptBuilderService,
        container.resolve("readmeStateDetectionService") as ReadmeStateDetectionService,
        container.resolve("readmeContentAnalysisService") as ReadmeContentAnalysisService,
        container.resolve("readmeBackupService") as ReadmeBackupService,
        container.resolve("readmeFileService") as ReadmeFileService,
        container.resolve("readmeDiffService") as ReadmeDiffService,
        container.resolve("vscodeDiffService") as VSCodeDiffService,
        container.resolve("readmeCacheService") as ReadmeCacheService,
        container.resolve("readmeSyncTrackerService") as ReadmeSyncTrackerService,
        container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
        container.resolve("eventBus"),
        loggingService,
      ),
  );
}
