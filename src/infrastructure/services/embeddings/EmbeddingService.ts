import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { ServiceLimits } from "@/constants";

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  timestamp: number;
}

export interface EmbeddingSimilarity {
  text1: string;
  text2: string;
  similarity: number;
  threshold: number;
  matches: boolean;
}

export class EmbeddingService {
  private embeddingCache = new Map<string, EmbeddingResult>();
  private readonly SIMILARITY_THRESHOLD = 0.8;
  private logger: Logger;

  constructor(private loggingService: LoggingService) {
    this.logger = createLogger("EmbeddingService");
  }

  async generateEmbedding(text: string, model: string = "default"): Promise<number[]> {
    const cacheKey = this.getCacheKey(text, model);
    const cached = this.embeddingCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ServiceLimits.cacheDefaultTTL) {
      this.logger.debug("Using cached embedding", { textLength: text.length, model });
      return cached.embedding;
    }

    const embedding = await this.computeEmbedding(text, model);

    this.embeddingCache.set(cacheKey, {
      embedding,
      model,
      timestamp: Date.now(),
    });

    this.logger.debug("Generated new embedding", { textLength: text.length, model });

    if (this.embeddingCache.size > ServiceLimits.maxPerformanceMetrics) {
      this.evictOldestEmbeddings();
    }

    return embedding;
  }

  async computeSimilarity(
    text1: string,
    text2: string,
    model: string = "default",
    threshold: number = this.SIMILARITY_THRESHOLD,
  ): Promise<EmbeddingSimilarity> {
    const [embedding1, embedding2] = await Promise.all([
      this.generateEmbedding(text1, model),
      this.generateEmbedding(text2, model),
    ]);

    const similarity = this.cosineSimilarity(embedding1, embedding2);

    return {
      text1,
      text2,
      similarity,
      threshold,
      matches: similarity >= threshold,
    };
  }

  async findSimilar(
    queryText: string,
    candidates: string[],
    model: string = "default",
    threshold: number = this.SIMILARITY_THRESHOLD,
    maxResults: number = 5,
  ): Promise<Array<{ text: string; similarity: number }>> {
    const queryEmbedding = await this.generateEmbedding(queryText, model);
    const similarities: Array<{ text: string; similarity: number }> = [];

    for (const candidate of candidates) {
      const candidateEmbedding = await this.generateEmbedding(candidate, model);
      const similarity = this.cosineSimilarity(queryEmbedding, candidateEmbedding);

      if (similarity >= threshold) {
        similarities.push({ text: candidate, similarity });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
  }

  private async computeEmbedding(text: string, model: string): Promise<number[]> {
    const normalizedText = this.normalizeText(text);

    if (model === "simple" || !this.hasEmbeddingAPI()) {
      return this.simpleEmbedding(normalizedText);
    }

    return this.apiEmbedding(normalizedText, model);
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, " ").substring(0, 1000);
  }

  private simpleEmbedding(text: string): number[] {
    const words = text.split(/\s+/);
    const embedding = new Array(128).fill(0);
    const wordsPerDimension = Math.max(1, Math.floor(words.length / embedding.length));

    for (let i = 0; i < embedding.length && i * wordsPerDimension < words.length; i++) {
      const word = words[i * wordsPerDimension] || "";
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
      }
      embedding[i] = Math.abs(hash) / 2147483647;
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map((val) => val / magnitude);
    }

    return embedding;
  }

  private async apiEmbedding(text: string, model: string): Promise<number[]> {
    this.logger.warn("Embedding API not configured, using simple embedding", { model });
    return this.simpleEmbedding(text);
  }

  private hasEmbeddingAPI(): boolean {
    return false;
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      this.logger.warn("Vector length mismatch", { len1: vec1.length, len2: vec2.length });
      return 0;
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      const v1 = vec1[i]!;
      const v2 = vec2[i]!;
      dotProduct += v1 * v2;
      magnitude1 += v1 * v1;
      magnitude2 += v2 * v2;
    }

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  private getCacheKey(text: string, model: string): string {
    const normalized = this.normalizeText(text);
    return `${model}:${normalized.substring(0, 100)}`;
  }

  private evictOldestEmbeddings(): void {
    const entries = Array.from(this.embeddingCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    for (const [key] of toRemove) {
      this.embeddingCache.delete(key);
    }

    this.logger.debug(`Evicted ${toRemove.length} old embeddings from cache`);
  }

  clearCache(): void {
    this.embeddingCache.clear();
    this.logger.debug("Cleared embedding cache");
  }

  dispose(): void {
    this.embeddingCache.clear();
  }
}
