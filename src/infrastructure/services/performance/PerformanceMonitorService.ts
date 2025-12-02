import { ServiceLimits } from "@/constants";

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceStats {
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastUpdated: number;
}

export interface CacheHitStats {
  hits: number;
  misses: number;
}

export interface TokenUsageStats {
  tokensUsed: number;
  tokensAvailable: number;
  efficiency: number;
  count: number;
}

export class PerformanceMonitorService {
  private metrics = new Map<string, PerformanceMetric[]>();
  private stats = new Map<string, PerformanceStats>();
  private cacheStats = new Map<string, CacheHitStats>();
  private tokenStats = new Map<string, TokenUsageStats>();
  private readonly MAX_METRICS = 1000;
  private readonly STATS_UPDATE_THRESHOLD = 10;

  startTimer(name: string, metadata?: Record<string, unknown>): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric(name, duration, metadata);
    };
  }

  recordMetric(name: string, duration: number, metadata?: Record<string, unknown>): void {
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    if (metrics.length > this.MAX_METRICS) {
      metrics.shift();
    }

    this.updateStats(name);
  }

  getStats(name: string): PerformanceStats | undefined {
    return this.stats.get(name);
  }

  getAllStats(): Record<string, PerformanceStats> {
    const result: Record<string, PerformanceStats> = {};
    for (const [name, stats] of this.stats.entries()) {
      result[name] = stats;
    }
    return result;
  }

  getMetrics(name: string, limit?: number): PerformanceMetric[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
      this.stats.delete(name);
    } else {
      this.metrics.clear();
      this.stats.clear();
    }
  }

  private updateStats(name: string): void {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return;
    }

    const recentMetrics = metrics.slice(-this.STATS_UPDATE_THRESHOLD);
    const durations = recentMetrics.map((m) => m.duration);

    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const averageDuration = totalDuration / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    this.stats.set(name, {
      count: metrics.length,
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      lastUpdated: Date.now(),
    });
  }

  getSlowOperations(threshold: number = 1000): PerformanceMetric[] {
    const slowOps: PerformanceMetric[] = [];

    for (const metrics of this.metrics.values()) {
      for (const metric of metrics) {
        if (metric.duration > threshold) {
          slowOps.push(metric);
        }
      }
    }

    return slowOps.sort((a, b) => b.duration - a.duration);
  }

  getPerformanceReport(): string {
    const report: string[] = [];
    report.push("=== Performance Report ===");

    for (const [name, stats] of this.stats.entries()) {
      report.push(`\n${name}:`);
      report.push(`  Count: ${stats.count}`);
      report.push(`  Average: ${stats.averageDuration.toFixed(2)}ms`);
      report.push(`  Min: ${stats.minDuration.toFixed(2)}ms`);
      report.push(`  Max: ${stats.maxDuration.toFixed(2)}ms`);
      report.push(`  Total: ${stats.totalDuration.toFixed(2)}ms`);
    }

    const slowOps = this.getSlowOperations();
    if (slowOps.length > 0) {
      report.push("\n=== Slow Operations (>1000ms) ===");
      slowOps.slice(0, ServiceLimits.maxSlowOpsDisplay).forEach((op) => {
        report.push(
          `${op.name}: ${op.duration.toFixed(2)}ms at ${new Date(op.timestamp).toISOString()}`,
        );
      });
    }

    return report.join("\n");
  }

  recordCacheHit(operation: string, hit: boolean): void {
    const key = `cache:${operation}`;
    if (!this.cacheStats.has(key)) {
      this.cacheStats.set(key, { hits: 0, misses: 0 });
    }

    const stats = this.cacheStats.get(key)!;
    if (hit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
  }

  getCacheHitRate(operation: string): number {
    const key = `cache:${operation}`;
    const stats = this.cacheStats.get(key);
    if (!stats) {
      return 0;
    }

    const total = stats.hits + stats.misses;
    return total > 0 ? stats.hits / total : 0;
  }

  getCacheStats(operation: string): CacheHitStats | undefined {
    const key = `cache:${operation}`;
    return this.cacheStats.get(key);
  }

  getAllCacheStats(): Record<string, CacheHitStats> {
    const result: Record<string, CacheHitStats> = {};
    for (const [key, stats] of this.cacheStats.entries()) {
      result[key] = { ...stats };
    }
    return result;
  }

  recordTokenUsage(operation: string, tokensUsed: number, tokensAvailable: number): void {
    const key = `tokens:${operation}`;
    const efficiency = tokensAvailable > 0 ? tokensUsed / tokensAvailable : 0;

    if (!this.tokenStats.has(key)) {
      this.tokenStats.set(key, {
        tokensUsed: 0,
        tokensAvailable: 0,
        efficiency: 0,
        count: 0,
      });
    }

    const stats = this.tokenStats.get(key)!;
    stats.tokensUsed += tokensUsed;
    stats.tokensAvailable += tokensAvailable;
    stats.count++;
    stats.efficiency = stats.tokensAvailable > 0 ? stats.tokensUsed / stats.tokensAvailable : 0;
  }

  getTokenUsageStats(operation: string): TokenUsageStats | undefined {
    const key = `tokens:${operation}`;
    return this.tokenStats.get(key);
  }

  getAllTokenUsageStats(): Record<string, TokenUsageStats> {
    const result: Record<string, TokenUsageStats> = {};
    for (const [key, stats] of this.tokenStats.entries()) {
      result[key] = { ...stats };
    }
    return result;
  }

  clearCacheStats(operation?: string): void {
    if (operation) {
      const key = `cache:${operation}`;
      this.cacheStats.delete(key);
    } else {
      this.cacheStats.clear();
    }
  }

  clearTokenStats(operation?: string): void {
    if (operation) {
      const key = `tokens:${operation}`;
      this.tokenStats.delete(key);
    } else {
      this.tokenStats.clear();
    }
  }
}
