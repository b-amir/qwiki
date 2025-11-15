export { ErrorHandler, ErrorHandlerImpl } from "./error/ErrorHandler";
export { ErrorRecoveryService } from "./error/ErrorRecoveryService";
export { ErrorLoggingService } from "./error/ErrorLoggingService";
export { createRetryStrategies, type RetryStrategy } from "./error/ErrorRecoveryStrategies";

export {
  LoggingService,
  createLogger,
  type LogEntry,
  type LoggerConfig,
  type Logger,
} from "./logging/LoggingService";
export { LogSanitizer } from "./logging/LogSanitizer";

export { CachingService } from "./caching/CachingService";
export { GenerationCacheService } from "./caching/GenerationCacheService";
export { LRUCache } from "./caching/LRUCache";
export {
  ProjectContextCacheService,
  type CachedProjectContextEntry,
  type ProjectContextCacheMetadata,
} from "./caching/ProjectContextCacheService";
export { ProjectContextCacheInvalidationService } from "./caching/ProjectContextCacheInvalidationService";
export {
  ProjectContextValidationService,
  type ProjectContextValidationResult,
} from "./caching/ProjectContextValidationService";
export {
  WorkspaceStructureCacheService,
  type CachedWorkspaceStructure,
  type CachedProjectType,
  type CachedEssentialFiles,
  type CachedFileRelevanceScores,
  type CachedDependencyMap,
} from "./caching/WorkspaceStructureCacheService";

export {
  PerformanceMonitorService,
  type PerformanceMetric,
  type PerformanceStats,
} from "./performance/PerformanceMonitorService";
export type {
  PerformanceMetric as PerformanceMonitorMetric,
  PerformanceStats as PerformanceMonitorStats,
} from "./performance/PerformanceMonitor";
export { MetricsCollectionService } from "./performance/MetricsCollectionService";
export { PerformanceMonitoringService } from "./performance/PerformanceMonitoringService";
export { StatisticsCalculationService } from "./performance/StatisticsCalculationService";

export { RequestBatchingService } from "./optimization/RequestBatchingService";
export { DebouncingService } from "./optimization/DebouncingService";
export { RateLimiterService, type RateLimitConfig } from "./optimization/RateLimiterService";
export { BackgroundProcessingService } from "./optimization/BackgroundProcessingService";
export { MemoryOptimizationService } from "./optimization/MemoryOptimizationService";
export { WebviewOptimizerService, Debouncer } from "./optimization/WebviewOptimizerService";

export { ProviderHealthService } from "./providers/ProviderHealthService";
export {
  ProviderPerformanceService,
  type PerformanceMetric as ProviderPerformanceMetric,
  type PerformanceStats as ProviderPerformanceStats,
  type ProviderRanking,
} from "./providers/ProviderPerformanceService";
export { ProviderFileSystemService } from "./providers/ProviderFileSystemService";
export {
  ProviderValidationService,
  type ValidationResult,
} from "./providers/ProviderValidationService";

export {
  ProjectIndexService,
  type IndexedFile,
  type ProjectIndexCache,
  type SymbolInfo,
} from "./indexing/ProjectIndexService";
export { FileMetadataExtractionService } from "./indexing/FileMetadataExtractionService";
export { IndexCacheService } from "./indexing/IndexCacheService";

export {
  LanguageServerIntegrationService,
  type SemanticCodeInfo,
} from "./integration/LanguageServerIntegrationService";
export {
  GitChangeDetectionService,
  type ChangedFile,
} from "./integration/GitChangeDetectionService";
export { VSCodeDiffService } from "./integration/VSCodeDiffService";

export { ExtensionContextStorageService } from "./storage/ExtensionContextStorageService";
export { ConfigurationBackupService } from "./storage/ConfigurationBackupService";
export { WikiWatcherService } from "./storage/WikiWatcherService";
export { SecretStorageValidator } from "./storage/SecretStorageValidator";

export { VSCodeFileSystemService } from "./filesystem/VSCodeFileSystemService";

export { ServiceReadinessManager } from "./ServiceReadinessManager";
