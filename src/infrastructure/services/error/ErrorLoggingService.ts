import { ProviderError } from "@/errors";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "@/infrastructure/services/logging/LoggingService";

export interface ErrorStatistics {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsByProvider: Record<string, number>;
  recentErrors: Array<{
    timestamp: number;
    code: string;
    providerId?: string;
    message: string;
  }>;
}

export class ErrorLoggingService {
  private logger: Logger;
  private readonly MAX_RECENT_ERRORS = 50;
  private readonly STORAGE_KEY = "qwiki-error-statistics";

  private errorStats: ErrorStatistics = {
    totalErrors: 0,
    errorsByCode: {},
    errorsByProvider: {},
    recentErrors: [],
  };

  constructor(private loggingService: LoggingService = new LoggingService()) {
    this.logger = createLogger("ErrorLoggingService");
    this.loadFromStorage();
  }

  private logDebug(message: string, data?: unknown): void {
    this.logger.debug(message, data);
  }

  private logErrorEntry(message: string, data?: unknown): void {
    this.logger.error(message, data);
  }

  private logWarnEntry(message: string, data?: unknown): void {
    this.logger.warn(message, data);
  }

  logError(error: ProviderError, context?: Record<string, unknown>): void {
    const timestamp = Date.now();

    this.logErrorEntry(`Provider Error logged: ${error.code}`, {
      code: error.code,
      message: error.message,
      providerId: error.providerId,
      timestamp: new Date(timestamp).toISOString(),
      context,
      stack: error.stack,
    });

    this.errorStats.totalErrors++;
    this.errorStats.errorsByCode[error.code] = (this.errorStats.errorsByCode[error.code] || 0) + 1;

    if (error.providerId) {
      this.errorStats.errorsByProvider[error.providerId] =
        (this.errorStats.errorsByProvider[error.providerId] || 0) + 1;
    }

    this.errorStats.recentErrors.unshift({
      timestamp,
      code: error.code,
      providerId: error.providerId,
      message: error.message,
    });

    if (this.errorStats.recentErrors.length > this.MAX_RECENT_ERRORS) {
      this.errorStats.recentErrors = this.errorStats.recentErrors.slice(0, this.MAX_RECENT_ERRORS);
    }

    this.saveToStorage();
  }

  logGenerationMetrics(providerId: string, success: boolean, duration: number): void {
    const timestamp = Date.now();
    const code = success ? "GENERATION_SUCCESS" : "GENERATION_FAILED";

    const logPayload = {
      providerId,
      duration: `${duration}ms`,
      timestamp: new Date(timestamp).toISOString(),
    };

    if (success) {
      this.logDebug("Generation successful", logPayload);
    } else {
      this.logErrorEntry("Generation failed", logPayload);
    }

    this.errorStats.totalErrors++;
    this.errorStats.errorsByCode[code] = (this.errorStats.errorsByCode[code] || 0) + 1;
    this.errorStats.errorsByProvider[providerId] =
      (this.errorStats.errorsByProvider[providerId] || 0) + 1;

    this.errorStats.recentErrors.unshift({
      timestamp,
      code,
      providerId,
      message: success
        ? `Generation successful in ${duration}ms`
        : `Generation failed after ${duration}ms`,
    });

    if (this.errorStats.recentErrors.length > this.MAX_RECENT_ERRORS) {
      this.errorStats.recentErrors = this.errorStats.recentErrors.slice(0, this.MAX_RECENT_ERRORS);
    }

    this.saveToStorage();
  }

  recordOperation(success: boolean): void {
    const code = success ? "OPERATION_SUCCESS" : "OPERATION_FAILED";

    this.errorStats.totalErrors++;
    this.errorStats.errorsByCode[code] = (this.errorStats.errorsByCode[code] || 0) + 1;

    this.errorStats.recentErrors.unshift({
      timestamp: Date.now(),
      code,
      message: success ? "Operation successful" : "Operation failed",
    });

    if (this.errorStats.recentErrors.length > this.MAX_RECENT_ERRORS) {
      this.errorStats.recentErrors = this.errorStats.recentErrors.slice(0, this.MAX_RECENT_ERRORS);
    }

    this.saveToStorage();
  }

  getErrorStats(): ErrorStatistics {
    return { ...this.errorStats };
  }

  clearStats(): void {
    this.errorStats = {
      totalErrors: 0,
      errorsByCode: {},
      errorsByProvider: {},
      recentErrors: [],
    };
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.errorStats));
      }
    } catch (error) {
      this.logWarnEntry("Failed to save error statistics to storage", error);
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (this.isValidStatistics(parsed)) {
            this.errorStats = parsed;
          }
        }
      }
    } catch (error) {
      this.logWarnEntry("Failed to load error statistics from storage", error);
    }
  }

  private isValidStatistics(data: unknown): data is ErrorStatistics {
    if (!data || typeof data !== "object") return false;
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.totalErrors === "number" &&
      typeof obj.errorsByCode === "object" &&
      typeof obj.errorsByProvider === "object" &&
      Array.isArray(obj.recentErrors)
    );
  }
}
