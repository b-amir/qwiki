import { CachingService } from "@/infrastructure/services/caching/CachingService";
import { EmbeddingService } from "@/infrastructure/services/embeddings/EmbeddingService";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { ServiceLimits } from "@/constants";
import { createHash } from "crypto";

export interface SemanticCacheEntry<T = any> {
  key: string;
  value: T;
  embedding: number[];
  text: string;
  timestamp: number;
  accessCount: number;
}

export interface SemanticCacheOptions {
  similarityThreshold?: number;
  maxEntries?: number;
  ttl?: number;
}

export interface SemanticCacheResult<T> {
  found: boolean;
  value?: T;
  similarity?: number;
  exactMatch?: boolean;
}

export class SemanticCacheService {
  private cache = new Map<string, SemanticCacheEntry>();
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.8;
  private readonly DEFAULT_MAX_ENTRIES = 100;
  private logger: Logger;

  constructor(
    private cachingService: CachingService,
    private embeddingService: EmbeddingService,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("SemanticCacheService");
  }

  async get<T>(text: string, options: SemanticCacheOptions = {}): Promise<SemanticCacheResult<T>> {
    const threshold = options.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD;
    const textHash = this.hashText(text);

    const exactEntry = this.cache.get(textHash);
    if (exactEntry && this.isValidEntry(exactEntry, options.ttl)) {
      exactEntry.accessCount++;
      this.logger.debug("Exact cache hit", { textLength: text.length });
      return {
        found: true,
        value: exactEntry.value as T,
        similarity: 1.0,
        exactMatch: true,
      };
    }

    const similarEntry = await this.findSimilarEntry(text, threshold, options.ttl);
    if (similarEntry) {
      similarEntry.entry.accessCount++;
      this.logger.debug("Semantic cache hit", {
        textLength: text.length,
        similarity: similarEntry.similarity,
      });
      return {
        found: true,
        value: similarEntry.entry.value as T,
        similarity: similarEntry.similarity,
        exactMatch: false,
      };
    }

    this.logger.debug("Cache miss", { textLength: text.length });
    return { found: false };
  }

  async set<T>(text: string, value: T, options: SemanticCacheOptions = {}): Promise<void> {
    const embedding = await this.embeddingService.generateEmbedding(text);
    const textHash = this.hashText(text);

    const entry: SemanticCacheEntry<T> = {
      key: textHash,
      value,
      embedding,
      text: text.substring(0, 500),
      timestamp: Date.now(),
      accessCount: 1,
    };

    this.cache.set(textHash, entry);

    const maxEntries = options.maxEntries || this.DEFAULT_MAX_ENTRIES;
    if (this.cache.size > maxEntries) {
      this.evictLeastAccessed();
    }

    await this.cachingService.set(textHash, entry, {
      ttl: options.ttl || ServiceLimits.cacheDefaultTTL,
    });

    this.logger.debug("Cached entry with semantic similarity", {
      textLength: text.length,
      cacheSize: this.cache.size,
    });
  }

  async invalidate(text: string): Promise<void> {
    const textHash = this.hashText(text);
    this.cache.delete(textHash);
    await this.cachingService.delete(textHash);
    this.logger.debug("Invalidated semantic cache entry", { textLength: text.length });
  }

  async invalidateSimilar(
    text: string,
    threshold: number = this.DEFAULT_SIMILARITY_THRESHOLD,
  ): Promise<number> {
    const similar = await this.findSimilarEntries(text, threshold);
    let count = 0;

    for (const entry of similar) {
      this.cache.delete(entry.key);
      await this.cachingService.delete(entry.key);
      count++;
    }

    this.logger.debug("Invalidated similar cache entries", {
      textLength: text.length,
      count,
      threshold,
    });

    return count;
  }

  getCacheStats(): {
    totalEntries: number;
    averageAccessCount: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.cache.values());

    if (entries.length === 0) {
      return {
        totalEntries: 0,
        averageAccessCount: 0,
        oldestEntry: 0,
        newestEntry: 0,
      };
    }

    const totalAccessCount = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const timestamps = entries.map((entry) => entry.timestamp);

    return {
      totalEntries: entries.length,
      averageAccessCount: totalAccessCount / entries.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
    };
  }

  private async findSimilarEntry(
    text: string,
    threshold: number,
    ttl?: number,
  ): Promise<{ entry: SemanticCacheEntry; similarity: number } | null> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(text);
    let bestMatch: { entry: SemanticCacheEntry; similarity: number } | null = null;
    let bestSimilarity = threshold;

    for (const entry of this.cache.values()) {
      if (!this.isValidEntry(entry, ttl)) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

      if (similarity >= bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { entry, similarity };
      }
    }

    return bestMatch;
  }

  private async findSimilarEntries(text: string, threshold: number): Promise<SemanticCacheEntry[]> {
    const queryEmbedding = await this.embeddingService.generateEmbedding(text);
    const similar: SemanticCacheEntry[] = [];

    for (const entry of this.cache.values()) {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

      if (similarity >= threshold) {
        similar.push(entry);
      }
    }

    return similar;
  }

  private isValidEntry(entry: SemanticCacheEntry, ttl?: number): boolean {
    if (!ttl) {
      return true;
    }

    return Date.now() - entry.timestamp < ttl;
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  private hashText(text: string): string {
    const normalized = text.toLowerCase().trim().substring(0, 500);
    return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
  }

  private evictLeastAccessed(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);

    const toRemove = entries.slice(0, Math.floor(entries.length / 4));
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }

    this.logger.debug(`Evicted ${toRemove.length} least accessed entries from semantic cache`);
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.debug("Cleared semantic cache");
  }

  dispose(): void {
    this.cache.clear();
  }
}
