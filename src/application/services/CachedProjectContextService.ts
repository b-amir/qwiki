import { CachingService } from "../../infrastructure/services/CachingService";
import { PerformanceMonitor } from "../../infrastructure/services/PerformanceMonitor";
import { ProjectContextService } from "./ProjectContextService";
import type { ProjectContext } from "../../domain/entities/Selection";
import type { Webview } from "vscode";

export class CachedProjectContextService {
  private readonly CACHE_TTL = 10 * 60 * 1000;

  constructor(
    private cacheService: CachingService,
    private performanceMonitor: PerformanceMonitor,
    private projectContextService: ProjectContextService,
  ) {}

  async buildContext(
    snippet: string,
    filePath?: string,
    languageId?: string,
    webview?: Webview,
  ): Promise<ProjectContext> {
    const endTimer = this.performanceMonitor.startTimer("buildProjectContext", {
      snippetLength: snippet.length,
      filePath,
      languageId,
    });

    const cacheKey = this.generateCacheKey(snippet, filePath, languageId);

    const cached = await this.cacheService.get<ProjectContext>(cacheKey);
    if (cached) {
      endTimer();
      return cached;
    }

    const context = await this.projectContextService.buildContext(
      snippet,
      filePath,
      languageId,
      webview,
    );
    await this.cacheService.set(cacheKey, context, { ttl: this.CACHE_TTL });

    endTimer();
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
