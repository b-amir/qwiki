import { workspace } from "vscode";
import { CachingService } from "@/infrastructure/services";
import { ProjectContextCacheService } from "@/infrastructure/services/caching/ProjectContextCacheService";
import {
  ProjectContextValidationService,
  type ProjectContextValidationResult,
} from "@/infrastructure/services/caching/ProjectContextValidationService";
import { PerformanceMonitorService } from "@/infrastructure/services/performance/PerformanceMonitorService";
import { ProjectContextService } from "@/application/services/context/project/ProjectContextService";
import type { ProjectContext } from "@/domain/entities/Selection";
import type { Webview } from "vscode";
import { ServiceLimits } from "@/constants";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class CachedProjectContextService {
  private readonly CACHE_TTL = ServiceLimits.projectContextCacheTTL;
  private logger: Logger;

  constructor(
    private cachingService: CachingService,
    private persistentCacheService: ProjectContextCacheService,
    private validationService: ProjectContextValidationService,
    private performanceMonitor: PerformanceMonitorService,
    private projectContextService: ProjectContextService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("CachedProjectContextService");
  }

  async buildContext(
    snippet: string,
    filePath?: string,
    languageId?: string,
    webview?: Webview,
  ): Promise<ProjectContext> {
    const startTime = Date.now();
    this.logger.debug("CachedProjectContextService.buildContext started", {
      snippetLength: snippet?.length || 0,
      filePath,
      languageId,
      hasWebview: !!webview,
    });

    const endTimer = this.performanceMonitor.startTimer("buildProjectContext", {
      snippetLength: snippet.length,
      filePath,
      languageId,
    });

    const snippetHash = this.simpleHash(snippet);
    const cacheKey = this.generateCacheKey(snippetHash, filePath, languageId);
    this.logger.debug("Generated cache key", { cacheKey, snippetHash });

    const cacheCheckStart = Date.now();
    const memoryCached = await this.cachingService.get<ProjectContext>(cacheKey);
    let cached: ProjectContext | null = memoryCached;

    if (!cached) {
      const persistentCached = await this.persistentCacheService.get(cacheKey);
      if (persistentCached) {
        const metadata = await this.persistentCacheService.getMetadata(cacheKey);
        if (metadata) {
          const validation = await this.validationService.validateMetadata(metadata);
          if (validation.isValid) {
            cached = persistentCached;
            await this.cachingService.set(cacheKey, cached, { ttl: this.CACHE_TTL });
            this.logger.debug("Loaded from persistent cache and validated", {
              reason: validation.reason,
            });
          } else {
            this.logger.debug("Persistent cache invalidated", {
              reason: validation.reason,
            });
            await this.persistentCacheService.delete(cacheKey);
          }
        } else {
          cached = persistentCached;
          await this.cachingService.set(cacheKey, cached, { ttl: this.CACHE_TTL });
        }
      }
    }

    this.logger.debug("Cache check completed", {
      duration: Date.now() - cacheCheckStart,
      cacheHit: !!cached,
      source: memoryCached ? "memory" : cached ? "persistent" : "miss",
    });

    if (cached) {
      this.logger.debug("Returning cached context", {
        rootName: cached.rootName,
        filesSampleCount: cached.filesSample?.length || 0,
        relatedCount: cached.related?.length || 0,
        overviewLength: cached.overview?.length || 0,
      });
      endTimer();
      return cached;
    }

    this.logger.debug("Cache miss, delegating to ProjectContextService");
    const buildStart = Date.now();
    const context = await this.projectContextService.buildContext(
      snippet,
      filePath,
      languageId,
      webview,
    );
    this.logger.debug("ProjectContextService.buildContext completed", {
      duration: Date.now() - buildStart,
      rootName: context.rootName,
      filesSampleCount: context.filesSample?.length || 0,
      relatedCount: context.related?.length || 0,
      overviewLength: context.overview?.length || 0,
    });

    const cacheSetStart = Date.now();
    const workspaceFolders = workspace.workspaceFolders;
    const workspaceRoot =
      workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : "";

    const metadata = await this.validationService.buildMetadata(
      workspaceRoot,
      snippetHash,
      filePath,
      languageId,
    );
    metadata.fileCount = context.filesSample?.length || 0;

    await Promise.all([
      this.cachingService.set(cacheKey, context, { ttl: this.CACHE_TTL }),
      this.persistentCacheService.set(cacheKey, context, metadata, this.CACHE_TTL),
    ]);

    this.logger.debug("Context cached", {
      duration: Date.now() - cacheSetStart,
      persistent: true,
    });

    endTimer();
    this.logger.debug("CachedProjectContextService.buildContext completed", {
      totalDuration: Date.now() - startTime,
    });
    return context;
  }

  private generateCacheKey(snippetHash: string, filePath?: string, languageId?: string): string {
    const pathHash = filePath ? this.simpleHash(filePath) : "";
    const langHash = languageId || "";
    return `${snippetHash}:${pathHash}:${langHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async clearCache(): Promise<void> {
    await Promise.all([this.cachingService.clear(), this.persistentCacheService.clear()]);
  }
}
