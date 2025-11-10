export { ErrorHandler, ErrorHandlerImpl } from "./ErrorHandler";
export { ErrorRecoveryService } from "./ErrorRecoveryService";
export { ErrorLoggingService } from "./ErrorLoggingService";
export { ConfigurationBackupService } from "./ConfigurationBackupService";
export { CachingService } from "./CachingService";
export { WebviewOptimizerService, Debouncer } from "./WebviewOptimizerService";
export {
  PerformanceMonitorService,
  type PerformanceMetric,
  type PerformanceStats,
} from "./PerformanceMonitorService";
export { ProviderHealthService } from "./ProviderHealthService";
export {
  ProviderPerformanceService,
  type PerformanceMetric as ProviderPerformanceMetric,
  type PerformanceStats as ProviderPerformanceStats,
  type ProviderRanking,
} from "./ProviderPerformanceService";
export { ProviderFileSystemService } from "./ProviderFileSystemService";
export { VSCodeFileSystemService } from "./VSCodeFileSystemService";
export { GenerationCacheService } from "./GenerationCacheService";
export { RequestBatchingService } from "./RequestBatchingService";
export { DebouncingService } from "./DebouncingService";
export { BackgroundProcessingService } from "./BackgroundProcessingService";
export { MemoryOptimizationService } from "./MemoryOptimizationService";
export {
  LoggingService,
  createLogger,
  type LogEntry,
  type LoggerConfig,
  type Logger,
} from "./LoggingService";
export { ProviderValidationService, type ValidationResult } from "./ProviderValidationService";
export {
  ProjectIndexService,
  type IndexedFile,
  type ProjectIndexCache,
  type SymbolInfo,
} from "./ProjectIndexService";
export {
  ProjectContextCacheService,
  type CachedProjectContextEntry,
  type ProjectContextCacheMetadata,
} from "./ProjectContextCacheService";
export {
  ProjectContextValidationService,
  type ProjectContextValidationResult,
} from "./ProjectContextValidationService";
export { ProjectContextCacheInvalidationService } from "./ProjectContextCacheInvalidationService";
export {
  WorkspaceStructureCacheService,
  type CachedWorkspaceStructure,
  type CachedProjectType,
  type CachedEssentialFiles,
  type CachedFileRelevanceScores,
  type CachedDependencyMap,
} from "./WorkspaceStructureCacheService";
export { WikiWatcherService } from "./WikiWatcherService";
export { ExtensionContextStorageService } from "./ExtensionContextStorageService";
export {
  LanguageServerIntegrationService,
  type SemanticCodeInfo,
} from "./LanguageServerIntegrationService";
export { GitChangeDetectionService, type ChangedFile } from "./GitChangeDetectionService";
export { VSCodeDiffService } from "./VSCodeDiffService";
