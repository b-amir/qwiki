import { EventEmitter } from "events";

export interface CacheEntry<T = unknown> {
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  priority?: number;
  tags?: string[];
}

export interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRate: number;
  averageAccessCount: number;
  oldestEntry: number;
  newestEntry: number;
}

export class CachingService extends EventEmitter {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private maxSize = 100;
  private defaultTtl = 300000;
  private totalSize = 0;
  private stats = {
    hitCount: 0,
    missCount: 0,
    evictionCount: 0,
  };

  constructor(options?: { maxSize?: number; defaultTtl?: number }) {
    super();
    if (options?.maxSize) {
      this.maxSize = options.maxSize;
    }
    if (options?.defaultTtl) {
      this.defaultTtl = options.defaultTtl;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.missCount++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.missCount++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);
    this.stats.hitCount++;

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTtl;
    const size = this.calculateSize(value);

    if (size > this.maxSize * 1024 * 1024) {
      return;
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: now + ttl,
      accessCount: 1,
      lastAccessed: now,
      size,
    };

    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.totalSize -= existingEntry.size;
    }

    this.cache.set(key, entry);
    this.totalSize += size;
    this.updateAccessOrder(key);

    if (options?.maxSize && this.cache.size > options.maxSize) {
      this.evictLRU(options.maxSize);
    } else if (this.cache.size > this.maxSize) {
      this.evictLRU(this.maxSize);
    }

    this.emit("set", key, entry);
  }

  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.totalSize -= entry.size;
      this.emit("delete", key);
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    this.totalSize = 0;
    this.emit("clear");
  }

  async evictExpired(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.totalSize -= entry.size;
        this.stats.evictionCount++;
      }
    }

    if (expiredKeys.length > 0) {
      this.emit("evict", expiredKeys);
    }
  }

  getStatistics(): CacheStatistics {
    const entries = Array.from(this.cache.values());
    const totalRequests = this.stats.hitCount + this.stats.missCount;

    return {
      totalEntries: this.cache.size,
      totalSize: this.totalSize,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      evictionCount: this.stats.evictionCount,
      hitRate: totalRequests > 0 ? this.stats.hitCount / totalRequests : 0,
      averageAccessCount:
        entries.length > 0
          ? entries.reduce((sum, entry) => sum + entry.accessCount, 0) / entries.length
          : 0,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.createdAt)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.createdAt)) : 0,
    };
  }

  private evictLRU(targetSize: number): void {
    while (this.cache.size > targetSize && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        const entry = this.cache.get(lruKey);
        if (entry) {
          this.cache.delete(lruKey);
          this.totalSize -= entry.size;
          this.stats.evictionCount++;
        }
      }
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private calculateSize(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024;
    }
  }
}
