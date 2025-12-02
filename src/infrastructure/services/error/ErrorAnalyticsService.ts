import { EventBus } from "@/events/EventBus";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";
import { ProviderError, ErrorCodes } from "@/errors";
import { ServiceLimits } from "@/constants";

export interface ErrorAnalytics {
  errorCode: string;
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
  totalOccurrences: number;
  providerIds: Set<string>;
  contexts: Array<Record<string, unknown>>;
  averageTimeBetweenOccurrences?: number;
}

export interface ErrorAggregation {
  totalErrors: number;
  errorsByCode: Map<string, ErrorAnalytics>;
  errorsByProvider: Map<string, number>;
  recentErrors: Array<{
    error: ProviderError;
    timestamp: number;
    context?: Record<string, unknown>;
  }>;
  errorRate: number;
  timeWindow: number;
}

interface OperationFailedEvent {
  error: unknown;
  context?: Record<string, unknown>;
}

interface ProviderGenerationFailedEvent {
  error: unknown;
  params?: unknown;
}

interface CachedResultUsedEvent {
  error: unknown;
  context?: Record<string, unknown>;
}

interface GenerationEvent {
  success?: boolean;
}

interface ErrorHistoryEntry {
  error: ProviderError;
  timestamp: number;
  context?: Record<string, unknown>;
}

export class ErrorAnalyticsService {
  private errorHistory: ErrorHistoryEntry[] = [];
  private errorAnalytics = new Map<string, ErrorAnalytics>();
  private totalOperations = 0;
  private readonly MAX_ERROR_HISTORY = ServiceLimits.maxPerformanceMetrics;
  private logger: Logger;

  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ErrorAnalyticsService");

    this.eventBus.subscribe("operationFailed", (event: OperationFailedEvent) => {
      if (event.error instanceof ProviderError) {
        this.recordError(event.error, event.context);
      }
    });

    this.eventBus.subscribe("providerGenerationFailed", (event: ProviderGenerationFailedEvent) => {
      if (event.error instanceof ProviderError) {
        this.recordError(event.error, { operation: "providerGeneration", params: event.params });
      }
    });

    this.eventBus.subscribe("cachedResultUsed", (event: CachedResultUsedEvent) => {
      if (event.error instanceof ProviderError) {
        this.recordErrorRecovery(event.error, event.context);
      }
    });

    this.eventBus.subscribe("generationSuccessful", (_event: GenerationEvent) => {
      this.recordOperation(true);
    });

    this.eventBus.subscribe("operationSuccessful", (_event: GenerationEvent) => {
      this.recordOperation(true);
    });

    this.eventBus.subscribe("wikiGenerationComplete", (event: GenerationEvent) => {
      if (event.success) {
        this.recordOperation(true);
      }
    });
  }

  recordError(error: ProviderError, context?: Record<string, unknown>): void {
    const timestamp = Date.now();
    this.totalOperations++;

    this.errorHistory.push({
      error,
      timestamp,
      context,
    });

    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory.shift();
    }

    const code = error.code;
    if (!this.errorAnalytics.has(code)) {
      this.errorAnalytics.set(code, {
        errorCode: code,
        count: 0,
        firstOccurrence: timestamp,
        lastOccurrence: timestamp,
        totalOccurrences: 0,
        providerIds: new Set<string>(),
        contexts: [],
      });
    }

    const analytics = this.errorAnalytics.get(code)!;
    analytics.count++;
    analytics.totalOccurrences++;
    analytics.lastOccurrence = timestamp;
    if (error.providerId) {
      analytics.providerIds.add(error.providerId);
    }
    if (context) {
      analytics.contexts.push(context);
      if (analytics.contexts.length > 100) {
        analytics.contexts.shift();
      }
    }

    this.calculateAverageTimeBetweenOccurrences(analytics);

    this.checkErrorRateSpike(code, context?.operation as string | undefined);

    this.eventBus.publish("errorAnalyticsUpdated", {
      errorCode: code,
      analytics,
      timestamp,
    });

    this.logger.debug("Recorded error for analytics", {
      errorCode: code,
      providerId: error.providerId,
      count: analytics.count,
    });
  }

  recordErrorRecovery(error: ProviderError, context?: Record<string, unknown>): void {
    this.logger.debug("Recorded error recovery", {
      errorCode: error.code,
      providerId: error.providerId,
      context,
    });

    this.eventBus.publish("errorRecoveryRecorded", {
      error,
      context,
      timestamp: Date.now(),
    });
  }

  recordOperation(success: boolean): void {
    this.totalOperations++;
  }

  private calculateAverageTimeBetweenOccurrences(analytics: ErrorAnalytics): void {
    const occurrences = this.errorHistory
      .filter((entry) => entry.error.code === analytics.errorCode)
      .map((entry) => entry.timestamp)
      .sort((a, b) => a - b);

    if (occurrences.length < 2) {
      return;
    }

    let totalTime = 0;
    for (let i = 1; i < occurrences.length; i++) {
      totalTime += occurrences[i] - occurrences[i - 1];
    }

    analytics.averageTimeBetweenOccurrences = totalTime / (occurrences.length - 1);
  }

  getErrorAnalytics(errorCode?: string): ErrorAnalytics | Map<string, ErrorAnalytics> {
    if (errorCode) {
      return (
        this.errorAnalytics.get(errorCode) || {
          errorCode,
          count: 0,
          firstOccurrence: 0,
          lastOccurrence: 0,
          totalOccurrences: 0,
          providerIds: new Set<string>(),
          contexts: [],
        }
      );
    }

    return new Map(this.errorAnalytics);
  }

  getErrorAggregation(timeWindowMs: number = 3600000): ErrorAggregation {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentErrors = this.errorHistory.filter((entry) => entry.timestamp > cutoffTime);

    const errorsByCode = new Map<string, ErrorAnalytics>();
    const errorsByProvider = new Map<string, number>();

    for (const entry of recentErrors) {
      const code = entry.error.code;
      if (!errorsByCode.has(code)) {
        errorsByCode.set(code, {
          errorCode: code,
          count: 0,
          firstOccurrence: entry.timestamp,
          lastOccurrence: entry.timestamp,
          totalOccurrences: 0,
          providerIds: new Set<string>(),
          contexts: [],
        });
      }

      const analytics = errorsByCode.get(code)!;
      analytics.count++;
      analytics.totalOccurrences++;
      analytics.lastOccurrence = Math.max(analytics.lastOccurrence, entry.timestamp);
      analytics.firstOccurrence = Math.min(analytics.firstOccurrence, entry.timestamp);

      if (entry.error.providerId) {
        analytics.providerIds.add(entry.error.providerId);
        errorsByProvider.set(
          entry.error.providerId,
          (errorsByProvider.get(entry.error.providerId) || 0) + 1,
        );
      }

      if (entry.context) {
        analytics.contexts.push(entry.context);
      }
    }

    for (const analytics of errorsByCode.values()) {
      this.calculateAverageTimeBetweenOccurrences(analytics);
    }

    const recentOperations = recentErrors.length;
    const errorRate = this.totalOperations > 0 ? recentOperations / this.totalOperations : 0;

    return {
      totalErrors: recentErrors.length,
      errorsByCode,
      errorsByProvider,
      recentErrors: recentErrors.slice(-50),
      errorRate,
      timeWindow: timeWindowMs,
    };
  }

  getTopErrors(limit: number = 10, timeWindowMs: number = 3600000): ErrorAnalytics[] {
    const aggregation = this.getErrorAggregation(timeWindowMs);
    const errors = Array.from(aggregation.errorsByCode.values());

    return errors.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  getErrorsByProvider(providerId: string, timeWindowMs: number = 3600000): ErrorHistoryEntry[] {
    const cutoffTime = Date.now() - timeWindowMs;

    return this.errorHistory.filter(
      (entry) => entry.error.providerId === providerId && entry.timestamp > cutoffTime,
    );
  }

  getErrorRate(timeWindowMs: number = 3600000): number {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentErrors = this.errorHistory.filter((entry) => entry.timestamp > cutoffTime).length;
    const recentOperations = this.errorHistory.filter(
      (entry) => entry.timestamp > cutoffTime,
    ).length;

    return recentOperations > 0 ? recentErrors / recentOperations : 0;
  }

  getErrorRateByOperation(operation: string, timeWindowMs: number = 3600000): number {
    const cutoffTime = Date.now() - timeWindowMs;
    const operationErrors = this.errorHistory.filter(
      (entry) => entry.timestamp > cutoffTime && entry.context?.operation === operation,
    ).length;

    const operationTotal = this.errorHistory.filter(
      (entry) => entry.timestamp > cutoffTime && entry.context?.operation === operation,
    ).length;

    return operationTotal > 0 ? operationErrors / operationTotal : 0;
  }

  private checkErrorRateSpike(errorCode: string, operation?: string): void {
    const shortWindow = 300000;
    const longWindow = 3600000;

    const shortWindowRate = operation
      ? this.getErrorRateByOperation(operation, shortWindow)
      : this.getErrorRate(shortWindow);
    const longWindowRate = operation
      ? this.getErrorRateByOperation(operation, longWindow)
      : this.getErrorRate(longWindow);

    if (shortWindowRate > longWindowRate * 2 && shortWindowRate > 0.1) {
      this.logger.warn("Error rate spike detected", {
        errorCode,
        operation,
        shortWindowRate,
        longWindowRate,
        spikeFactor: shortWindowRate / (longWindowRate || 0.001),
      });

      this.eventBus.publish("errorRateSpike", {
        errorCode,
        operation,
        shortWindowRate,
        longWindowRate,
        timestamp: Date.now(),
      });
    }
  }

  getCommonErrors(operation?: string, limit: number = 5): Array<{ error: string; count: number }> {
    const operationErrors = operation
      ? this.errorHistory.filter((entry) => entry.context?.operation === operation)
      : this.errorHistory;

    const errorCounts = new Map<string, number>();

    for (const entry of operationErrors) {
      const key = `${entry.error.code}:${entry.error.message}`;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }

    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  clearAnalytics(): void {
    this.errorHistory = [];
    this.errorAnalytics.clear();
    this.totalOperations = 0;

    this.eventBus.publish("errorAnalyticsCleared", { timestamp: Date.now() });
    this.logger.debug("Cleared error analytics");
  }

  exportAnalytics(): {
    errorHistory: Array<{
      error: { code: string; message: string; providerId?: string };
      timestamp: number;
      context?: Record<string, unknown>;
    }>;
    errorAnalytics: Record<string, Omit<ErrorAnalytics, "providerIds"> & { providerIds: string[] }>;
    totalOperations: number;
  } {
    const exportedAnalytics: Record<
      string,
      Omit<ErrorAnalytics, "providerIds"> & { providerIds: string[] }
    > = {};

    for (const [code, analytics] of this.errorAnalytics.entries()) {
      exportedAnalytics[code] = {
        ...analytics,
        providerIds: Array.from(analytics.providerIds),
      };
    }

    return {
      errorHistory: this.errorHistory.map((entry) => ({
        error: {
          code: entry.error.code,
          message: entry.error.message,
          providerId: entry.error.providerId,
        },
        timestamp: entry.timestamp,
        context: entry.context,
      })),
      errorAnalytics: exportedAnalytics,
      totalOperations: this.totalOperations,
    };
  }

  dispose(): void {
    this.errorHistory = [];
    this.errorAnalytics.clear();
    this.totalOperations = 0;
  }
}
