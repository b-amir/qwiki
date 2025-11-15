import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { ServiceLimits } from "@/constants/ServiceLimits";
import { RateLimitError } from "@/errors";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiterService {
  private rateLimiters = new Map<string, RateLimiter>();
  private logger: Logger;

  constructor(
    private loggingService: LoggingService = new LoggingService(),
    private defaultConfig: RateLimitConfig = {
      maxRequests: ServiceLimits.rateLimitMaxRequests,
      windowMs: ServiceLimits.rateLimitWindowMs,
    },
  ) {
    this.logger = createLogger("RateLimiterService");
  }

  getLimiter(key: string, config?: RateLimitConfig): RateLimiter {
    if (!this.rateLimiters.has(key)) {
      const limiterConfig = config || this.defaultConfig;
      this.rateLimiters.set(key, new RateLimiter(limiterConfig, this.loggingService));
      this.logger.debug("Created rate limiter", { key, config: limiterConfig });
    }
    return this.rateLimiters.get(key)!;
  }

  async checkLimit(key: string, config?: RateLimitConfig): Promise<void> {
    const limiter = this.getLimiter(key, config);
    await limiter.checkLimit();
  }

  clearLimiter(key: string): void {
    this.rateLimiters.delete(key);
    this.logger.debug("Cleared rate limiter", { key });
  }

  clearAll(): void {
    this.rateLimiters.clear();
    this.logger.debug("Cleared all rate limiters");
  }

  getLimiterStats(key: string): { requestCount: number; oldestRequest: number | null } | null {
    const limiter = this.rateLimiters.get(key);
    if (!limiter) {
      return null;
    }
    return limiter.getStats();
  }
}

class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private logger: Logger;

  constructor(
    private readonly config: RateLimitConfig,
    loggingService: LoggingService,
  ) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.logger = createLogger("RateLimiter");
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();

    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      const errorMessage = `Rate limit exceeded. Retry in ${Math.ceil(waitTime / 1000)}s`;

      this.logger.warn("Rate limit exceeded", {
        requestCount: this.requests.length,
        maxRequests: this.maxRequests,
        waitTimeMs: waitTime,
      });

      throw new RateLimitError(waitTime, errorMessage, {
        requestCount: this.requests.length,
        maxRequests: this.maxRequests,
      });
    }

    this.requests.push(now);
    this.logger.debug("Rate limit check passed", {
      requestCount: this.requests.length,
      maxRequests: this.maxRequests,
    });
  }

  getStats(): { requestCount: number; oldestRequest: number | null } {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    return {
      requestCount: this.requests.length,
      oldestRequest: this.requests.length > 0 ? this.requests[0] : null,
    };
  }

  clear(): void {
    this.requests = [];
    this.logger.debug("Rate limiter cleared");
  }
}
