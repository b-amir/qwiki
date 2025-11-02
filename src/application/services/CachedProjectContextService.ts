import { CachingService } from "../../infrastructure/services/CachingService";
import { PerformanceMonitorService } from "../../infrastructure/services/PerformanceMonitorService";
import { ProjectContextService } from "./ProjectContextService";
import type { ProjectContext } from "../../domain/entities/Selection";
import type { Webview } from "vscode";
import { ServiceLimits } from "../../constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export class CachedProjectContextService {
  private readonly CACHE_TTL = ServiceLimits.projectContextCacheTTL;
  private logger: Logger;

  constructor(
    private cacheService: CachingService,
    private performanceMonitor: PerformanceMonitorService,
    private projectContextService: ProjectContextService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("CachedProjectContextService", loggingService);
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

    const cacheKey = this.generateCacheKey(snippet, filePath, languageId);
    this.logger.debug("Generated cache key", { cacheKey });

    const cacheCheckStart = Date.now();
    const cached = await this.cacheService.get<ProjectContext>(cacheKey);
    this.logger.debug("Cache check completed", {
      duration: Date.now() - cacheCheckStart,
      cacheHit: !!cached,
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
    await this.cacheService.set(cacheKey, context, { ttl: this.CACHE_TTL });
    this.logger.debug("Context cached", { duration: Date.now() - cacheSetStart });

    endTimer();
    this.logger.debug("CachedProjectContextService.buildContext completed", {
      totalDuration: Date.now() - startTime,
    });
    return context;
  }

  private generateCacheKey(snippet: string, filePath?: string, languageId?: string): string {
    const snippetHash = this.simpleHash(snippet);
    const pathHash = filePath ? this.simpleHash(filePath) : "";
    const langHash = languageId || "";
    return `project-context:${snippetHash}:${pathHash}:${langHash}`;
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
    await this.cacheService.clear();
  }
}
