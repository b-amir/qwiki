export interface CacheKey {
  providerId: string;
  templateId: string;
  context: string;
  hash: string;
}

export interface CacheEntry {
  key: CacheKey;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  ttl?: number;
}

export interface CacheStatistics {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

export class OutputCacheService {
  private store = new Map<string, CacheEntry>();
  private order: string[] = [];
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private maxSize = 500;

  async cacheOutput(key: CacheKey, content: string, ttl?: number): Promise<void> {
    const id = this.idFor(key);
    const entry: CacheEntry = { key, content, timestamp: Date.now(), ttl };
    if (this.store.has(id)) this.touch(id);
    this.store.set(id, entry);
    this.ensureCapacity();
  }

  async getFromCache(key: CacheKey): Promise<string | null> {
    const id = this.idFor(key);
    const entry = this.store.get(id);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (this.isExpired(entry)) {
      this.store.delete(id);
      this.removeFromOrder(id);
      this.misses++;
      return null;
    }
    this.hits++;
    this.touch(id);
    return entry.content;
  }

  async invalidateCache(key: CacheKey): Promise<void> {
    const id = this.idFor(key);
    if (this.store.delete(id)) this.removeFromOrder(id);
  }

  async clearCache(pattern?: string): Promise<void> {
    if (!pattern) {
      this.store.clear();
      this.order = [];
      return;
    }
    for (const id of Array.from(this.store.keys()))
      if (id.includes(pattern)) {
        this.store.delete(id);
        this.removeFromOrder(id);
      }
  }

  async getCacheStats(): Promise<CacheStatistics> {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  async optimizeCache(): Promise<void> {
    this.evictExpired();
    this.ensureCapacity();
  }

  generateKey(params: { providerId: string; templateId: string; context: unknown }): CacheKey {
    const contextStr = this.safeStringify(params.context);
    const hash = this.simpleHash(`${params.providerId}|${params.templateId}|${contextStr}`);
    return {
      providerId: params.providerId,
      templateId: params.templateId,
      context: contextStr,
      hash,
    };
  }

  private ensureCapacity(): void {
    while (this.store.size > this.maxSize) {
      const oldest = this.order.shift();
      if (!oldest) break;
      if (this.store.delete(oldest)) this.evictions++;
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.store.entries())
      if (entry.ttl && entry.timestamp + entry.ttl < now) {
        this.store.delete(id);
        this.removeFromOrder(id);
      }
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl) return false;
    return entry.timestamp + entry.ttl < Date.now();
  }

  private touch(id: string): void {
    this.removeFromOrder(id);
    this.order.push(id);
  }

  private removeFromOrder(id: string): void {
    const idx = this.order.indexOf(id);
    if (idx >= 0) this.order.splice(idx, 1);
  }

  private idFor(key: CacheKey): string {
    return `${key.providerId}::${key.templateId}::${key.hash}`;
  }

  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private simpleHash(input: string): string {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    const hex = (h >>> 0).toString(16);
    return hex.padStart(8, "0");
  }
}
