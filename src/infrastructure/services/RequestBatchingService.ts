import { EventEmitter } from "events";

export interface BatchedRequest<T = any> {
  id: string;
  request: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  timestamp: number;
  priority: number;
  key?: string;
}

export interface BatchOptions {
  maxBatchSize?: number;
  maxWaitTime?: number;
  priority?: number;
  key?: string;
  deduplicationKey?: string;
}

export interface BatchStatistics {
  totalBatches: number;
  totalRequests: number;
  averageBatchSize: number;
  averageWaitTime: number;
  deduplicatedRequests: number;
  priorityBatches: number;
}

export class RequestBatchingService extends EventEmitter {
  private batches = new Map<string, BatchedRequest[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private statistics = {
    totalBatches: 0,
    totalRequests: 0,
    totalWaitTime: 0,
    deduplicatedRequests: 0,
    priorityBatches: 0,
  };
  private readonly defaultMaxBatchSize = 10;
  private readonly defaultMaxWaitTime = 50;

  async batchRequest<T>(request: () => Promise<T>, options?: BatchOptions): Promise<T> {
    const batchSize = options?.maxBatchSize ?? this.defaultMaxBatchSize;
    const waitTime = options?.maxWaitTime ?? this.defaultMaxWaitTime;
    const priority = options?.priority ?? 0;
    const key = options?.key ?? "default";
    const deduplicationKey = options?.deduplicationKey;

    if (deduplicationKey) {
      const existingRequest = this.findExistingRequest<T>(deduplicationKey);
      if (existingRequest) {
        return new Promise<T>((resolve, reject) => {
          const batchedRequest: BatchedRequest<T> = {
            id: this.generateId(),
            request,
            resolve,
            reject,
            timestamp: Date.now(),
            priority,
            key: deduplicationKey,
          };

          existingRequest.push(batchedRequest);
          this.statistics.deduplicatedRequests++;
        });
      }
    }

    return new Promise<T>((resolve, reject) => {
      const batchedRequest: BatchedRequest<T> = {
        id: this.generateId(),
        request,
        resolve,
        reject,
        timestamp: Date.now(),
        priority,
        key: deduplicationKey,
      };

      if (!this.batches.has(key)) {
        this.batches.set(key, []);
      }

      const batch = this.batches.get(key)!;
      batch.push(batchedRequest);
      batch.sort((a, b) => b.priority - a.priority);

      if (priority > 0) {
        this.statistics.priorityBatches++;
      }

      if (batch.length >= batchSize) {
        this.processBatch(key);
      } else if (!this.batchTimers.has(key)) {
        const timer = setTimeout(() => {
          this.processBatch(key);
        }, waitTime);
        this.batchTimers.set(key, timer);
      }

      this.statistics.totalRequests++;
    });
  }

  async flushBatch(key?: string): Promise<void> {
    if (key) {
      this.processBatch(key);
    } else {
      for (const batchKey of this.batches.keys()) {
        this.processBatch(batchKey);
      }
    }
  }

  getBatchStatistics(): BatchStatistics {
    const totalBatches = this.statistics.totalBatches;
    const totalRequests = this.statistics.totalRequests;
    const averageBatchSize = totalBatches > 0 ? totalRequests / totalBatches : 0;
    const averageWaitTime = totalBatches > 0 ? this.statistics.totalWaitTime / totalBatches : 0;

    return {
      totalBatches,
      totalRequests,
      averageBatchSize,
      averageWaitTime,
      deduplicatedRequests: this.statistics.deduplicatedRequests,
      priorityBatches: this.statistics.priorityBatches,
    };
  }

  configureBatching(options: { defaultMaxBatchSize?: number; defaultMaxWaitTime?: number }): void {
    if (options.defaultMaxBatchSize !== undefined) {
      (this as any).defaultMaxBatchSize = options.defaultMaxBatchSize;
    }
    if (options.defaultMaxWaitTime !== undefined) {
      (this as any).defaultMaxWaitTime = options.defaultMaxWaitTime;
    }
  }

  private async processBatch(key: string): Promise<void> {
    const batch = this.batches.get(key);
    if (!batch || batch.length === 0) {
      return;
    }

    const timer = this.batchTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(key);
    }

    const now = Date.now();
    const waitTime = now - batch[0].timestamp;
    this.statistics.totalWaitTime += waitTime;
    this.statistics.totalBatches++;

    this.batches.delete(key);

    const deduplicatedGroups = new Map<string, BatchedRequest[]>();

    for (const request of batch) {
      if (request.key) {
        if (!deduplicatedGroups.has(request.key)) {
          deduplicatedGroups.set(request.key, []);
        }
        deduplicatedGroups.get(request.key)!.push(request);
      } else {
        deduplicatedGroups.set(request.id, [request]);
      }
    }

    const processPromises = Array.from(deduplicatedGroups.entries()).map(
      async ([groupKey, requests]) => {
        try {
          const result = await requests[0].request();
          for (const request of requests) {
            request.resolve(result);
          }
        } catch (error) {
          for (const request of requests) {
            request.reject(error);
          }
        }
      },
    );

    await Promise.allSettled(processPromises);
    this.emit("batchProcessed", key, batch.length);
  }

  private findExistingRequest<T>(key: string): BatchedRequest<T>[] | null {
    for (const batch of this.batches.values()) {
      const existing = batch.find((req) => req.key === key);
      if (existing) {
        return batch.filter((req) => req.key === key);
      }
    }
    return null;
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
