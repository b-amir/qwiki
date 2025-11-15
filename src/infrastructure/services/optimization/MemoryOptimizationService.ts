import { EventEmitter } from "events";

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  percentageUsed: number;
}

export interface MemoryLeakReport {
  detectedLeaks: MemoryLeak[];
  totalLeakedBytes: number;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: number;
}

export interface MemoryLeak {
  objectId: string;
  objectType: string;
  size: number;
  retainedSize: number;
  stackTrace: string[];
  severity: "low" | "medium" | "high" | "critical";
}

export interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

export class MemoryOptimizationService extends EventEmitter {
  private memoryLimit = 512 * 1024 * 1024; // 512MB default
  private cleanupInterval: NodeJS.Timeout | null = null;
  private objectPools = new Map<string, ObjectPool<any>>();
  private memorySnapshots: MemoryUsage[] = [];
  private leakDetectionEnabled = false;
  private gcAvailable = false;

  constructor() {
    super();
    this.gcAvailable = typeof global.gc === "function";
  }

  getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    const percentageUsed = (usage.heapUsed / this.memoryLimit) * 100;

    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers,
      percentageUsed,
    };
  }

  async optimizeMemory(): Promise<void> {
    const beforeUsage = this.getMemoryUsage();

    this.clearObjectPools();
    this.clearMemorySnapshots();

    if (this.gcAvailable && global.gc) {
      global.gc();
    }

    await this.forceGarbageCollection();

    const afterUsage = this.getMemoryUsage();
    const freedMemory = beforeUsage.heapUsed - afterUsage.heapUsed;

    this.emit("memoryOptimized", {
      before: beforeUsage,
      after: afterUsage,
      freedMemory,
    });
  }

  setMemoryLimit(limit: number): void {
    this.memoryLimit = limit;
    this.emit("memoryLimitChanged", limit);
  }

  scheduleCleanup(interval: number): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      const usage = this.getMemoryUsage();

      if (usage.percentageUsed > 80) {
        await this.optimizeMemory();
      }

      if (this.leakDetectionEnabled) {
        this.detectMemoryLeaks();
      }

      this.captureMemorySnapshot();
    }, interval);

    this.emit("cleanupScheduled", interval);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.emit("cleanupStopped");
    }
  }

  forceGarbageCollection(): void {
    if (this.gcAvailable && global.gc) {
      global.gc();
      this.emit("garbageCollected");
    }
  }

  createObjectPool<T>(
    name: string,
    factory: () => T,
    resetFn?: (obj: T) => void,
    maxSize = 100,
  ): ObjectPool<T> {
    const pool: T[] = [];

    const objectPool: ObjectPool<T> = {
      acquire(): T {
        if (pool.length > 0) {
          return pool.pop()!;
        }
        return factory();
      },

      release(obj: T): void {
        if (pool.length < maxSize) {
          if (resetFn) {
            resetFn(obj);
          }
          pool.push(obj);
        }
      },

      size(): number {
        return pool.length;
      },

      clear(): void {
        pool.length = 0;
      },
    };

    this.objectPools.set(name, objectPool);
    return objectPool;
  }

  getObjectPool<T>(name: string): ObjectPool<T> | null {
    return this.objectPools.get(name) || null;
  }

  clearObjectPools(): void {
    for (const pool of this.objectPools.values()) {
      pool.clear();
    }
    this.emit("objectPoolsCleared");
  }

  enableLeakDetection(enabled: boolean): void {
    this.leakDetectionEnabled = enabled;
    this.emit("leakDetectionToggled", enabled);
  }

  detectMemoryLeaks(): MemoryLeakReport | null {
    if (!this.leakDetectionEnabled) {
      return null;
    }

    const currentUsage = this.getMemoryUsage();
    const leaks: MemoryLeak[] = [];

    if (this.memorySnapshots.length > 0) {
      const previousUsage = this.memorySnapshots[this.memorySnapshots.length - 1];
      const growth = currentUsage.heapUsed - previousUsage.heapUsed;

      if (growth > 10 * 1024 * 1024) {
        // 10MB growth
        leaks.push({
          objectId: `heap_${Date.now()}`,
          objectType: "Heap",
          size: growth,
          retainedSize: growth,
          stackTrace: [],
          severity: growth > 50 * 1024 * 1024 ? "critical" : "high",
        });
      }
    }

    if (leaks.length === 0) {
      return null;
    }

    const totalLeakedBytes = leaks.reduce((sum, leak) => sum + leak.size, 0);
    const maxSeverity = leaks.reduce((max, leak) => {
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      return Math.max(max, severityLevels[leak.severity]);
    }, 0);

    const severityMap = ["low", "medium", "high", "critical"] as const;
    const severity = severityMap[maxSeverity - 1];

    const report: MemoryLeakReport = {
      detectedLeaks: leaks,
      totalLeakedBytes,
      severity,
      timestamp: Date.now(),
    };

    this.emit("memoryLeakDetected", report);
    return report;
  }

  captureMemorySnapshot(): void {
    const usage = this.getMemoryUsage();
    this.memorySnapshots.push(usage);

    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots.shift();
    }
  }

  clearMemorySnapshots(): void {
    this.memorySnapshots = [];
    this.emit("memorySnapshotsCleared");
  }

  getMemorySnapshots(): MemoryUsage[] {
    return [...this.memorySnapshots];
  }

  getMemoryTrend(): {
    trend: "increasing" | "decreasing" | "stable";
    rate: number;
  } {
    if (this.memorySnapshots.length < 2) {
      return { trend: "stable", rate: 0 };
    }

    const recent = this.memorySnapshots.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];

    const timeDiff = last.heapUsed - first.heapUsed;
    const rate = timeDiff / recent.length;

    let trend: "increasing" | "decreasing" | "stable";
    if (Math.abs(rate) < 1024 * 1024) {
      // Less than 1MB change
      trend = "stable";
    } else if (rate > 0) {
      trend = "increasing";
    } else {
      trend = "decreasing";
    }

    return { trend, rate };
  }
}
