import { CachingService, CacheOptions } from "@/infrastructure/services/caching/CachingService";
import { SemanticCacheService } from "@/infrastructure/services/caching/SemanticCacheService";
import { GenerateParams, GenerateResult } from "@/llm/types";
import { createHash } from "crypto";
import { ServiceLimits } from "@/constants";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";

export class GenerationCacheService {
  private readonly cacheKeyPrefix = "generation:";
  private readonly defaultCacheTtl = 3600000; // 1 hour
  private logger: Logger;

  constructor(
    private cachingService: CachingService,
    private semanticCacheService?: SemanticCacheService,
    private loggingService?: LoggingService,
    private enableSemanticCaching: boolean = false,
    private semanticSimilarityThreshold: number = 0.8,
  ) {
    this.logger = loggingService 
      ? createLogger("GenerationCacheService")
      : { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger;
  }


  async getCachedGeneration(params: GenerateParams): Promise<GenerateResult | null> {
    const cacheKey = this.generateCacheKey(params);
    
    const exactMatch = await this.cachingService.get<GenerateResult>(cacheKey);
    if (exactMatch) {
      this.logger.debug("Exact cache hit", { cacheKey });
      return exactMatch;
    }

    if (this.enableSemanticCaching && this.semanticCacheService) {
      const snippetText = this.getSnippetForSemanticSearch(params);
      const semanticResult = await this.semanticCacheService.get<GenerateResult>(
        snippetText,
        {
          similarityThreshold: this.semanticSimilarityThreshold,
          ttl: this.defaultCacheTtl,
        }
      );

      if (semanticResult.found) {
        this.logger.info("Semantic cache hit", { 
          similarity: semanticResult.similarity,
          exactMatch: semanticResult.exactMatch 
        });
        return semanticResult.value || null;
      }
    }

    this.logger.debug("Cache miss", { cacheKey });
    return null;
  }


  async cacheGeneration(params: GenerateParams, result: GenerateResult): Promise<void> {
    const cacheKey = this.generateCacheKey(params);
    const options: CacheOptions = {
      ttl: this.defaultCacheTtl,
      maxSize: 10,
      tags: this.generateCacheTags(params),
    };
    
    await this.cachingService.set(cacheKey, result, options);
    
    if (this.enableSemanticCaching && this.semanticCacheService) {
      const snippetText = this.getSnippetForSemanticSearch(params);
      await this.semanticCacheService.set(snippetText, result, {
        similarityThreshold: this.semanticSimilarityThreshold,
        ttl: this.defaultCacheTtl,
      });
      this.logger.debug("Stored in semantic cache", { snippetLength: snippetText.length });
    }
  }

  generateCacheKey(params: GenerateParams): string {
    const normalizedParams = this.normalizeParams(params);
    const paramsString = JSON.stringify(normalizedParams);
    const hash = createHash("sha256").update(paramsString).digest("hex");
    return `${this.cacheKeyPrefix}${hash}`;
  }

  async invalidateCache(pattern: string): Promise<void> {
    const stats = this.cachingService.getStatistics();
    const keysToInvalidate: string[] = [];

    for (const key of Array.from({ length: stats.totalEntries }, (_, i) => i.toString())) {
      if (key.startsWith(this.cacheKeyPrefix) && key.includes(pattern)) {
        keysToInvalidate.push(key);
      }
    }

    for (const key of keysToInvalidate) {
      await this.cachingService.delete(key);
    }
  }

  async warmCache(commonParams: GenerateParams[]): Promise<void> {
    const warmingPromises = commonParams.map(async (params) => {
      const cacheKey = this.generateCacheKey(params);
      const cached = await this.cachingService.get<GenerateResult>(cacheKey);

      if (!cached) {
        const options: CacheOptions = {
          ttl: this.defaultCacheTtl,
          maxSize: 5,
          priority: 1,
          tags: ["warm-cache"],
        };
        await this.cachingService.set(cacheKey, { content: "" }, options);
      }
    });

    await Promise.all(warmingPromises);
  }

  private normalizeParams(params: GenerateParams): GenerateParams {
    return {
      snippet: params.snippet.trim(),
      languageId: params.languageId?.toLowerCase(),
      filePath: params.filePath?.toLowerCase(),
      model: params.model?.toLowerCase(),
      project: params.project
        ? {
            rootName: params.project.rootName?.toLowerCase(),
            overview: params.project.overview?.substring(0, 500),
            filesSample: params.project.filesSample?.slice(0, ServiceLimits.maxCacheFileSample),
            related: params.project.related?.slice(0, ServiceLimits.maxCacheRelated).map((r) => ({
              path: r.path.toLowerCase(),
              preview: r.preview?.substring(0, 200),
              line: r.line,
              reason: r.reason?.toLowerCase(),
            })),
          }
        : undefined,
    };
  }

  private generateCacheTags(params: GenerateParams): string[] {
    const tags: string[] = [];

    if (params.languageId) {
      tags.push(`lang:${params.languageId.toLowerCase()}`);
    }

    if (params.model) {
      tags.push(`model:${params.model.toLowerCase()}`);
    }

    if (params.project?.rootName) {
      tags.push(`project:${params.project.rootName.toLowerCase()}`);
    }

    const snippetSize = params.snippet.length;
    if (snippetSize < 100) {
      tags.push("size:small");
    } else if (snippetSize < 500) {
      tags.push("size:medium");
    } else {
      tags.push("size:large");
    }

    return tags;
  }

  private getSnippetForSemanticSearch(params: GenerateParams): string {
    const parts = [params.snippet];
    
    if (params.languageId) {
      parts.push(`Language: ${params.languageId}`);
    }
    
    if (params.filePath) {
      parts.push(`File: ${params.filePath}`);
    }
    
    return parts.join("\n").trim();
  }
}
