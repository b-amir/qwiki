import { CachingService } from "../../infrastructure/services/CachingService";
import { PerformanceMonitor } from "../../infrastructure/services/PerformanceMonitor";
import {
  GenerationCacheService,
  RequestBatchingService,
  DebouncingService,
  BackgroundProcessingService,
  MemoryOptimizationService,
} from "../../infrastructure/services";
import type { LLMRegistry } from "../../llm";
import type { WikiGenerationRequest, WikiGenerationResult } from "../../domain/entities/Wiki";
import type { ProjectContext } from "../../domain/entities/Selection";
import type { LoadingStep } from "../../constants/Events";
import { ServiceLimits } from "../../constants";
import { WikiService } from "./WikiService";

export class CachedWikiService {
  private readonly CACHE_TTL = ServiceLimits.cacheDefaultTTL;
  private wikiService: WikiService;

  constructor(
    private llmRegistry: LLMRegistry,
    private cacheService: CachingService,
    private performanceMonitor: PerformanceMonitor,
    private generationCacheService: GenerationCacheService,
    private requestBatchingService: RequestBatchingService,
    private debouncingService: DebouncingService,
    private backgroundProcessingService: BackgroundProcessingService,
    private memoryOptimizationService: MemoryOptimizationService,
  ) {
    this.wikiService = new WikiService(
      llmRegistry,
      generationCacheService,
      requestBatchingService,
      debouncingService,
      backgroundProcessingService,
      memoryOptimizationService,
    );
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

    const cached = await this.cacheService.get<WikiGenerationResult>(cacheKey);
    if (cached) {
      endTimer();
      return cached;
    }

    const result = await this.wikiService.generateWiki(request, projectContext, onProgress);

    if (result.success) {
      await this.cacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });
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

    const contextKey = [
      projectContext.rootName || "",
      projectContext.overview || "",
      projectContext.filesSample?.slice(0, ServiceLimits.maxCacheFileSample).join(",") || "",
      projectContext.related
        ?.slice(0, ServiceLimits.maxCacheRelated)
        .map((r) => `${r.path}:${r.line}`)
        .join(",") || "",
    ].join("|");
    const contextHash = this.simpleHash(contextKey);

    return `wiki-generation:${snippetHash}:${providerHash}:${modelHash}:${languageHash}:${filePathHash}:${contextHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
  }

  async clearCache(): Promise<void> {
    await this.cacheService.clear();
  }
}
