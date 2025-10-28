import { CacheService } from "../../infrastructure/services/CacheService";
import { PerformanceMonitor } from "../../infrastructure/services/PerformanceMonitor";
import type { LLMRegistry } from "../../llm";
import type { WikiGenerationRequest, WikiGenerationResult } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import type { LoadingStep } from "../../constants/Events";
import { WikiService } from "./WikiService";

export class CachedWikiService {
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  private wikiService: WikiService;

  constructor(
    private llmRegistry: LLMRegistry,
    private cacheService: CacheService,
    private performanceMonitor: PerformanceMonitor
  ) {
    this.wikiService = new WikiService(llmRegistry);
  }

  async generateWiki(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    onProgress?: (step: LoadingStep) => void,
  ): Promise<WikiGenerationResult> {
    const endTimer = this.performanceMonitor.startTimer("generateWiki", {
      providerId: request.providerId,
      model: request.model,
      snippetLength: request.snippet.length,
      languageId: request.languageId,
    });

    const cacheKey = this.generateCacheKey(request, projectContext);
    
    const cached = this.cacheService.get<WikiGenerationResult>(cacheKey);
    if (cached) {
      endTimer();
      return cached;
    }

    const result = await this.wikiService.generateWiki(request, projectContext, onProgress);
    
    if (result.success) {
      this.cacheService.set(cacheKey, result, this.CACHE_TTL);
    }
    
    endTimer();
    return result;
  }

  private generateCacheKey(request: WikiGenerationRequest, projectContext: ProjectContext): string {
    const snippetHash = this.simpleHash(request.snippet);
    const providerHash = request.providerId || "";
    const modelHash = request.model || "";
    const languageHash = request.languageId || "";
    const filePathHash = request.filePath ? this.simpleHash(request.filePath) : "";
    const contextHash = this.simpleHash(JSON.stringify(projectContext));
    
    return `wiki-generation:${snippetHash}:${providerHash}:${modelHash}:${languageHash}:${filePathHash}:${contextHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  clearCache(): void {
    this.cacheService.clear();
  }
}