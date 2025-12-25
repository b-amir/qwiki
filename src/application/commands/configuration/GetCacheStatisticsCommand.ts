import { GenerationCacheService } from "@/infrastructure/services/caching/GenerationCacheService";
import { SemanticCacheService } from "@/infrastructure/services/caching/SemanticCacheService";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export interface CacheStatistics {
  enabled: boolean;
  semanticCacheStats: {
    totalEntries: number;
    averageAccessCount: number;
    oldestEntry: number;
    newestEntry: number;
  } | null;
  estimatedHitRate: number;
  totalCacheSize: number;
}

export class GetCacheStatisticsCommand {
  private logger: Logger;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private generationCacheService: GenerationCacheService,
    private semanticCacheService: SemanticCacheService | undefined,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("GetCacheStatisticsCommand");
  }

  async execute(): Promise<CacheStatistics> {
    const semanticStats = this.semanticCacheService
      ? this.semanticCacheService.getCacheStats()
      : null;

    // Calculate estimated hit rate from log messages
    // In production, this would track actual hits/misses
    const totalAccesses = this.cacheHits + this.cacheMisses;
    const estimatedHitRate = totalAccesses > 0 ? (this.cacheHits / totalAccesses) * 100 : 0;

    return {
      enabled: this.semanticCacheService !== undefined,
      semanticCacheStats: semanticStats,
      estimatedHitRate,
      totalCacheSize: semanticStats ? semanticStats.totalEntries : 0,
    };
  }

  // Called by GenerationCacheService to track metrics
  recordCacheHit(semantic: boolean): void {
    this.cacheHits++;
    this.logger.debug(`Cache hit (semantic: ${semantic})`, {
      totalHits: this.cacheHits,
      hitRate: this.getHitRate(),
    });
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
    this.logger.debug("Cache miss", {
      totalMisses: this.cacheMisses,
      hitRate: this.getHitRate(),
    });
  }

  private getHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? (this.cacheHits / total) * 100 : 0;
  }

  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.logger.info("Cache metrics reset");
  }
}
