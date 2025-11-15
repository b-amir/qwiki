import { CachingService, CacheOptions } from "@/infrastructure/services/caching/CachingService";
import { GenerateParams, GenerateResult } from "@/llm/types";
import { createHash } from "crypto";
import { ServiceLimits } from "@/constants";

export class GenerationCacheService {
  private readonly cacheKeyPrefix = "generation:";
  private readonly defaultCacheTtl = 3600000; // 1 hour

  constructor(private cachingService: CachingService) {}

  async getCachedGeneration(params: GenerateParams): Promise<GenerateResult | null> {
    const cacheKey = this.generateCacheKey(params);
    return this.cachingService.get<GenerateResult>(cacheKey);
  }

  async cacheGeneration(params: GenerateParams, result: GenerateResult): Promise<void> {
    const cacheKey = this.generateCacheKey(params);
    const options: CacheOptions = {
      ttl: this.defaultCacheTtl,
      maxSize: 10,
      tags: this.generateCacheTags(params),
    };
    await this.cachingService.set(cacheKey, result, options);
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
            related: params.project.related
              ?.slice(0, ServiceLimits.maxCacheRelated)
              .map((r: any) => ({
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
}
