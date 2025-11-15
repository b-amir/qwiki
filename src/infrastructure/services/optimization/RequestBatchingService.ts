import { EventEmitter } from "events";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

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
  private requestsByKey = new Map<string, BatchedRequest[]>();
  private statistics = {
    totalBatches: 0,
    totalRequests: 0,
    totalWaitTime: 0,
    deduplicatedRequests: 0,
    priorityBatches: 0,
  };
  private readonly defaultMaxBatchSize = 10;
  private readonly defaultMaxWaitTime = 50;
  private logger: Logger;

  constructor(loggingService?: LoggingService) {
    super();
    this.logger = loggingService
      ? createLogger("RequestBatchingService")
      : ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } as Logger);
  }

  async batchRequest<T>(request: () => Promise<T>, options?: BatchOptions): Promise<T> {
    const batchSize = options?.maxBatchSize ?? this.defaultMaxBatchSize;
    const waitTime = options?.maxWaitTime ?? this.defaultMaxWaitTime;
    const priority = options?.priority ?? 0;
    const key = options?.key ?? "default";
    const deduplicationKey = options?.deduplicationKey;

    if (priority > 0 || batchSize > 5) {
      this.logger.debug("batchRequest called", {
        batchKey: key,
        batchSize,
        waitTime,
        priority,
      });
    }

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

      if (deduplicationKey) {
        if (!this.requestsByKey.has(deduplicationKey)) {
          this.requestsByKey.set(deduplicationKey, []);
        }
        this.requestsByKey.get(deduplicationKey)!.push(batchedRequest);
      }

      if (priority > 0) {
        this.statistics.priorityBatches++;
      }

      if (batch.length >= batchSize * 0.8) {
        this.logger.debug("Added request to batch", {
          batchKey: key,
          batchSize: batch.length,
        });
      }

      if (batch.length >= batchSize) {
        this.logger.debug("Batch size reached, processing immediately", { batchKey: key });
        this.processBatch(key);
      } else if (!this.batchTimers.has(key)) {
        this.logger.debug("Setting batch timer", { batchKey: key, waitTime });
        const timer = setTimeout(() => {
          this.logger.debug("Batch timer fired", { batchKey: key });
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
    const startTime = Date.now();
    this.logger.debug("processBatch started", { batchKey: key });

    const batch = this.batches.get(key);
    if (!batch || batch.length === 0) {
      this.logger.debug("processBatch: no batch or empty batch", { batchKey: key });
      return;
    }

    this.logger.debug("processBatch: processing batch", {
      batchKey: key,
      batchSize: batch.length,
    });

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
        const allRequestsWithKey = this.requestsByKey.get(request.key) || [];
        if (!deduplicatedGroups.has(request.key)) {
          deduplicatedGroups.set(request.key, [...allRequestsWithKey]);
        }
      } else {
        deduplicatedGroups.set(request.id, [request]);
      }
    }

    this.logger.debug("processBatch: created deduplicated groups", {
      batchKey: key,
      groupCount: deduplicatedGroups.size,
    });

    const processPromises = Array.from(deduplicatedGroups.entries()).map(
      async ([groupKey, requests]) => {
        const groupStartTime = Date.now();

        try {
          const result = await requests[0].request();
          const duration = Date.now() - groupStartTime;
          if (duration > 1000) {
            this.logger.debug("Request executed successfully", {
              duration,
            });
          }

          const allRequestsWithKey = this.requestsByKey.get(groupKey) || [];

          const requestMap = new Map<string, BatchedRequest>();
          for (const req of requests) {
            requestMap.set(req.id, req);
          }
          for (const req of allRequestsWithKey) {
            requestMap.set(req.id, req);
          }
          const allRequestsToResolve = Array.from(requestMap.values());

          for (const request of allRequestsToResolve) {
            request.resolve(result);
          }

          if (this.requestsByKey.has(groupKey)) {
            this.requestsByKey.delete(groupKey);
          }
        } catch (error) {
          const duration = Date.now() - groupStartTime;
          this.logger.debug("Request execution failed", {
            duration,
            error: error instanceof Error ? error.message : String(error),
          });

          const allRequestsWithKey = this.requestsByKey.get(groupKey) || [];
          const requestMap = new Map<string, BatchedRequest>();
          for (const req of requests) {
            requestMap.set(req.id, req);
          }
          for (const req of allRequestsWithKey) {
            requestMap.set(req.id, req);
          }
          const allRequestsToReject = Array.from(requestMap.values());

          for (const request of allRequestsToReject) {
            request.reject(error);
          }

          if (this.requestsByKey.has(groupKey)) {
            this.requestsByKey.delete(groupKey);
          }
        }
      },
    );

    this.logger.debug("processBatch: waiting for all promises to settle", {
      batchKey: key,
      promiseCount: processPromises.length,
    });
    await Promise.allSettled(processPromises);
    this.logger.debug("processBatch completed", {
      batchKey: key,
      duration: Date.now() - startTime,
    });
    this.emit("batchProcessed", key, batch.length);
  }

  private findExistingRequest<T>(key: string): BatchedRequest<T>[] | null {
    const existing = this.requestsByKey.get(key);
    return existing && existing.length > 0 ? (existing as BatchedRequest<T>[]) : null;
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
