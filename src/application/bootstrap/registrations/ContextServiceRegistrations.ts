import { Container } from "@/container/Container";
import type { ExtensionContext } from "vscode";
import { ExtensionContextStorageService, LoggingService } from "@/infrastructure/services";
import {
  ProjectContextService,
  CachedProjectContextService,
  TextUsageSearchService,
  ProjectOverviewService,
  PatternExtractionService,
  StructureAnalysisService,
  RelationshipAnalysisService,
  ComplexityCalculationService,
  ContextAnalysisService,
  ProjectTypeDetectionService,
  DependencyAnalysisService,
  FileRelevanceAnalysisService,
  FileRelevanceBatchService,
  FileSelectionService,
  CodeExtractionService,
  ContextSuggestionService,
  ContextIntelligenceService,
  ContextCompressionService,
  AdvancedPromptService,
  PromptQualityService,
  ProviderSelectionService,
} from "../../services";
import { ProjectContextCacheService } from "@/infrastructure/services/caching/ProjectContextCacheService";
import { WorkspaceStructureCacheService } from "@/infrastructure/services/caching/WorkspaceStructureCacheService";
import { ProjectContextValidationService } from "@/infrastructure/services/caching/ProjectContextValidationService";
import { ProjectContextCacheInvalidationService } from "@/infrastructure/services/caching/ProjectContextCacheInvalidationService";
import { ProjectIndexService } from "@/infrastructure/services/indexing/ProjectIndexService";
import { VSCodeFileSystemService } from "@/infrastructure/services/filesystem/VSCodeFileSystemService";
import { CachingService } from "@/infrastructure/services";
import { DebouncingService } from "@/infrastructure/services/optimization/DebouncingService";
import { PerformanceMonitorService } from "@/infrastructure/services/performance/PerformanceMonitorService";
import { LLMRegistry } from "@/llm";
import { ProviderHealthService } from "@/infrastructure/services/providers/ProviderHealthService";

export function registerContextServices(
  container: Container,
  context: ExtensionContext,
  loggingService: LoggingService,
): void {
  container.register(
    "textUsageSearchService",
    () =>
      new TextUsageSearchService(
        loggingService,
        container.resolve("cachingService") as CachingService,
        container.resolve("projectIndexService") as ProjectIndexService,
      ),
  );

  container.register("projectOverviewService", () => new ProjectOverviewService(loggingService));

  container.register(
    "projectContextCacheService",
    () =>
      new ProjectContextCacheService(
        container.resolve("extensionContextStorageService") as ExtensionContextStorageService,
        loggingService,
        false,
      ),
  );

  container.register(
    "workspaceStructureCacheService",
    () =>
      new WorkspaceStructureCacheService(
        container.resolve("extensionContextStorageService") as ExtensionContextStorageService,
        loggingService,
        false,
      ),
  );

  container.register(
    "projectContextValidationService",
    () => new ProjectContextValidationService(loggingService),
  );

  container.register(
    "projectContextCacheInvalidationService",
    () =>
      new ProjectContextCacheInvalidationService(
        container.resolve("projectContextCacheService") as ProjectContextCacheService,
        container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
        loggingService,
        container.resolve("debouncingService") as DebouncingService,
      ),
  );

  container.registerLazy("projectContextService", async () => {
    return new ProjectContextService(
      loggingService,
      (await container.resolveLazy("projectIndexService")) as ProjectIndexService,
      container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
      container.resolve("textUsageSearchService") as TextUsageSearchService,
      container.resolve("projectOverviewService") as ProjectOverviewService,
    );
  });

  container.registerLazy("cachedProjectContextService", async () => {
    return new CachedProjectContextService(
      container.resolve("cachingService"),
      container.resolve("projectContextCacheService") as ProjectContextCacheService,
      container.resolve("projectContextValidationService") as ProjectContextValidationService,
      container.resolve("performanceMonitor"),
      (await container.resolveLazy("projectContextService")) as ProjectContextService,
      loggingService,
    );
  });

  container.register(
    "patternExtractionService",
    () => new PatternExtractionService(loggingService),
  );

  container.register(
    "structureAnalysisService",
    () =>
      new StructureAnalysisService(
        loggingService,
        container.resolve("patternExtractionService") as PatternExtractionService,
      ),
  );

  container.register(
    "relationshipAnalysisService",
    () => new RelationshipAnalysisService(loggingService),
  );

  container.register(
    "complexityCalculationService",
    () => new ComplexityCalculationService(loggingService),
  );

  container.registerLazy("contextAnalysisService", async () => {
    return new ContextAnalysisService(
      container.resolve("eventBus"),
      loggingService,
      container.resolve("complexityCalculationService") as ComplexityCalculationService,
      container.resolve("patternExtractionService") as PatternExtractionService,
      container.resolve("structureAnalysisService") as StructureAnalysisService,
      container.resolve("relationshipAnalysisService") as RelationshipAnalysisService,
    );
  });

  container.registerLazy("projectTypeDetectionService", async () => {
    return new ProjectTypeDetectionService(
      container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
      container.resolve("cachingService") as CachingService,
      container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
      loggingService,
    );
  });

  container.registerLazy("dependencyAnalysisService", async () => {
    return new DependencyAnalysisService(
      container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
      container.resolve("cachingService") as CachingService,
      container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
      loggingService,
    );
  });

  container.registerLazy("fileRelevanceAnalysisService", async () => {
    const configRepo = container.resolve(
      "configurationRepository",
    ) as import("@/domain/repositories/ConfigurationRepository").ConfigurationRepository;
    const enableSemanticMatching =
      (await configRepo.get<boolean>("enableSemanticCaching")) ?? false;

    return new FileRelevanceAnalysisService(
      container.resolve("vscodeFileSystemService") as VSCodeFileSystemService,
      container.resolve("cachingService") as CachingService,
      container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
      (await container.resolveLazy("dependencyAnalysisService")) as DependencyAnalysisService,
      loggingService,
      enableSemanticMatching ? container.resolve("embeddingService") : undefined,
      enableSemanticMatching,
    );
  });

  container.registerLazy("fileRelevanceBatchService", async () => {
    const projectIndexService = (await container.resolveLazy(
      "projectIndexService",
    )) as ProjectIndexService;
    const indexCacheService = projectIndexService.getIndexCacheService();
    return new FileRelevanceBatchService(
      container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
      (await container.resolveLazy("fileRelevanceAnalysisService")) as FileRelevanceAnalysisService,
      indexCacheService,
      loggingService,
    );
  });

  container.register("fileSelectionService", () => new FileSelectionService(loggingService));

  container.register("codeExtractionService", () => new CodeExtractionService(loggingService));

  container.register(
    "contextSuggestionService",
    () => new ContextSuggestionService(loggingService),
  );

  container.register(
    "contextCompressionService",
    () =>
      new ContextCompressionService(
        loggingService,
        container.resolve("codeExtractionService") as CodeExtractionService,
      ),
  );

  container.registerLazy("contextIntelligenceService", async () => {
    return new ContextIntelligenceService(
      (await container.resolveLazy("contextAnalysisService")) as ContextAnalysisService,
      (await container.resolveLazy("cachedProjectContextService")) as CachedProjectContextService,
      await container.resolveLazy("providerSelectionService"),
      (await container.resolveLazy("projectTypeDetectionService")) as ProjectTypeDetectionService,
      (await container.resolveLazy("fileRelevanceAnalysisService")) as FileRelevanceAnalysisService,
      (await container.resolveLazy("fileRelevanceBatchService")) as FileRelevanceBatchService,
      container.resolve("fileSelectionService") as FileSelectionService,
      container.resolve("cachingService") as CachingService,
      container.resolve("workspaceStructureCacheService") as WorkspaceStructureCacheService,
      container.resolve("performanceMonitor") as PerformanceMonitorService,
      container.resolve("eventBus"),
      loggingService,
      await container.resolveLazy("llmRegistry"),
      (await container.resolveLazy("projectIndexService")) as ProjectIndexService,
      container.resolve("contextSuggestionService") as ContextSuggestionService,
    );
  });

  container.registerLazy("advancedPromptService", async () => {
    return new AdvancedPromptService(
      loggingService,
      (await container.resolveLazy("contextAnalysisService")) as ContextAnalysisService,
      container.resolve("eventBus"),
      container.resolve("promptQualityService") as PromptQualityService,
    );
  });

  container.register(
    "promptQualityService",
    () => new PromptQualityService(loggingService, container.resolve("eventBus")),
  );
}
