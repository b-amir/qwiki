export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastUpdated: number;
}

export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>();
  private stats = new Map<string, PerformanceStats>();
  private readonly MAX_METRICS = 1000;
  private readonly STATS_UPDATE_THRESHOLD = 10;

  startTimer(name: string, metadata?: Record<string, any>): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(name, duration, metadata);
    };
  }

  recordMetric(name: string, duration: number, metadata?: Record<string, any>): void {
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
    const durations = recentMetrics.map(m => m.duration);
    
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
      slowOps.slice(0, 10).forEach(op => {
        report.push(`${op.name}: ${op.duration.toFixed(2)}ms at ${new Date(op.timestamp).toISOString()}`);
      });
    }

    return report.join("\n");
  }
}