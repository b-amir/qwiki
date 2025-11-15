import { createHash } from "crypto";
import type { CacheOptions } from "@/infrastructure/services/caching/CachingService";
import { CachingService } from "@/infrastructure/services";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { ServiceLimits } from "@/constants/ServiceLimits";

interface ReadmeCacheEntry {
  generatedContent: string;
  wikiIds: string[];
  readmeHash: string;
  timestamp: number;
}

export class ReadmeCacheService {
  private logger: Logger;
  private readonly cacheKeyPrefix = "readme:";
  private readonly defaultCacheTtl = 3600000; // 1 hour
  private wikiIdToCacheKeys = new Map<string, Set<string>>();

  constructor(
    private cachingService: CachingService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadmeCacheService");
  }

  async getCachedReadme(wikiIds: string[], currentReadme: string): Promise<string | null> {
    const cacheKey = this.generateCacheKey(wikiIds, currentReadme);
    const cached = await this.cachingService.get<ReadmeCacheEntry>(cacheKey);

    if (!cached) {
      this.logger.debug("Cache miss for README generation", {
        wikiCount: wikiIds.length,
        cacheKey: cacheKey.substring(0, 20) + "...",
      });
      return null;
    }

    const readmeHash = this.hashContent(currentReadme);
    if (cached.readmeHash !== readmeHash) {
      this.logger.debug("Cache invalidated due to README content change");
      await this.cachingService.delete(cacheKey);
      return null;
    }

    this.logger.debug("Cache hit for README generation", {
      wikiCount: wikiIds.length,
      age: Date.now() - cached.timestamp,
    });

    return cached.generatedContent;
  }

  async cacheReadme(
    wikiIds: string[],
    currentReadme: string,
    generatedContent: string,
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(wikiIds, currentReadme);
    const readmeHash = this.hashContent(currentReadme);

    const entry: ReadmeCacheEntry = {
      generatedContent,
      wikiIds: [...wikiIds].sort(),
      readmeHash,
      timestamp: Date.now(),
    };

    const options: CacheOptions = {
      ttl: this.defaultCacheTtl,
      maxSize: 50,
      tags: this.generateCacheTags(wikiIds),
    };

    await this.cachingService.set(cacheKey, entry, options);

    for (const wikiId of wikiIds) {
      if (!this.wikiIdToCacheKeys.has(wikiId)) {
        this.wikiIdToCacheKeys.set(wikiId, new Set());
      }
      this.wikiIdToCacheKeys.get(wikiId)!.add(cacheKey);
    }

    this.logger.debug("Cached README generation result", {
      wikiCount: wikiIds.length,
      cacheKey: cacheKey.substring(0, 20) + "...",
    });
  }

  async invalidateForWiki(wikiId: string): Promise<void> {
    const cacheKeys = this.wikiIdToCacheKeys.get(wikiId);
    if (!cacheKeys || cacheKeys.size === 0) {
      return;
    }

    const keysToInvalidate = Array.from(cacheKeys);

    for (const key of keysToInvalidate) {
      await this.cachingService.delete(key);
      for (const [id, keys] of this.wikiIdToCacheKeys.entries()) {
        keys.delete(key);
        if (keys.size === 0) {
          this.wikiIdToCacheKeys.delete(id);
        }
      }
    }

    this.wikiIdToCacheKeys.delete(wikiId);

    if (keysToInvalidate.length > 0) {
      this.logger.debug("Invalidated cache entries for wiki", {
        wikiId,
        invalidatedCount: keysToInvalidate.length,
      });
    }
  }

  async invalidateAll(): Promise<void> {
    const allKeys = new Set<string>();
    for (const keys of this.wikiIdToCacheKeys.values()) {
      for (const key of keys) {
        allKeys.add(key);
      }
    }

    for (const key of allKeys) {
      await this.cachingService.delete(key);
    }

    this.wikiIdToCacheKeys.clear();

    if (allKeys.size > 0) {
      this.logger.debug("Invalidated all README cache entries", {
        invalidatedCount: allKeys.size,
      });
    }
  }

  private generateCacheKey(wikiIds: string[], currentReadme: string): string {
    const sortedIds = [...wikiIds].sort().join(",");
    const readmeHash = this.hashContent(currentReadme);
    const keyData = `${sortedIds}:${readmeHash}`;
    const hash = createHash("sha256").update(keyData).digest("hex");
    return `${this.cacheKeyPrefix}${hash}`;
  }

  private hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private generateCacheTags(wikiIds: string[]): string[] {
    const tags: string[] = ["readme-update"];
    tags.push(`wiki-count:${wikiIds.length}`);
    return tags;
  }
}
