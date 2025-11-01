import { EventBus } from "../../events/EventBus";
import { SmartProviderSelectionService } from "./SmartProviderSelectionService";
import { ProviderHealthService } from "../../infrastructure/services/ProviderHealthService";
import { LLMRegistry } from "../../llm/providers/registry";
import { ProviderError } from "../../errors/ProviderError";
import { DeepContextAnalysis } from "./ContextAnalysisService";
import { ServiceLimits } from "../../constants";
import {
  LoggingService,
  createLogger,
  type Logger,
} from "../../infrastructure/services/LoggingService";

export interface FallbackStrategy {
  type: "immediate" | "exponential" | "linear" | "adaptive";
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
  nonRetryableErrors: string[];
}

export interface FallbackResult<T> {
  success: boolean;
  result?: T;
  error?: ProviderError;
  attempts: number;
  totalDuration: number;
  usedProviders: string[];
  appliedStrategy: FallbackStrategy;
}

export interface ProviderOperation<T> {
  execute: (providerId: string) => Promise<T>;
  context?: DeepContextAnalysis;
  timeout?: number;
  priority?: "low" | "normal" | "high" | "critical";
}

export interface FallbackChain {
  primaryProvider: string;
  fallbackProviders: string[];
  strategy: FallbackStrategy;
  context: DeepContextAnalysis;
}

export class ProviderFallbackManagerService {
  private defaultStrategy: FallbackStrategy = {
    type: "exponential",
    maxAttempts: 3,
    baseDelay: ServiceLimits.baseRetryDelay,
    maxDelay: ServiceLimits.maxRetryDelay,
    retryableErrors: ["NETWORK_ERROR", "RATE_LIMIT_EXCEEDED", "GENERATION_FAILED", "TIMEOUT"],
    nonRetryableErrors: [
      "API_KEY_MISSING",
      "API_KEY_INVALID",
      "MODEL_NOT_SUPPORTED",
      "VALIDATION_ERROR",
      "CONFIGURATION_ERROR",
    ],
  };

  private circuitBreakers = new Map<
    string,
    {
      state: "closed" | "open" | "half-open";
      failureCount: number;
      lastFailureTime: number;
      nextAttemptTime: number;
    }
  >();

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000;
  private readonly CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT = ServiceLimits.circuitBreakerHalfOpenTimeout;
  private logger: Logger;

  constructor(
    private smartProviderSelectionService: SmartProviderSelectionService,
    private providerHealthService: ProviderHealthService,
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProviderFallbackManagerService", loggingService);
  }

  async executeWithFallback<T>(
    operation: ProviderOperation<T>,
    customStrategy?: Partial<FallbackStrategy>,
  ): Promise<FallbackResult<T>> {
    const strategy = { ...this.defaultStrategy, ...customStrategy };
    const startTime = Date.now();
    const usedProviders: string[] = [];
    let attempts = 0;
    let lastError: ProviderError | undefined;

    this.logger.debug("Executing operation with fallback", {
      strategy: strategy.type,
      maxAttempts: strategy.maxAttempts,
    });

    const fallbackChain = await this.createFallbackChain(operation);
    const providersToTry = [fallbackChain.primaryProvider, ...fallbackChain.fallbackProviders];

    for (const providerId of providersToTry) {
      if (attempts >= strategy.maxAttempts) {
        this.logger.warn("Max attempts reached", { attempts, maxAttempts: strategy.maxAttempts });
        break;
      }

      if (!this.isProviderAvailable(providerId)) {
        this.logger.debug("Provider skipped", {
          providerId,
          reason: "Circuit breaker is open or provider is unhealthy",
        });
        this.eventBus.publish("provider-skipped", {
          providerId,
          reason: "Circuit breaker is open or provider is unhealthy",
        });
        continue;
      }

      usedProviders.push(providerId);
      attempts++;

      try {
        const result = await this.executeWithTimeout(
          () => operation.execute(providerId),
          operation.timeout || ServiceLimits.operationDefaultTimeout,
        );

        this.recordSuccess(providerId);

        return {
          success: true,
          result,
          attempts,
          totalDuration: Date.now() - startTime,
          usedProviders,
          appliedStrategy: strategy,
        };
      } catch (error) {
        lastError = error as ProviderError;
        this.recordFailure(providerId, lastError);

        if (!this.shouldRetry(lastError, strategy)) {
          break;
        }

        if (attempts < strategy.maxAttempts) {
          const delay = this.calculateDelay(attempts, strategy);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalDuration: Date.now() - startTime,
      usedProviders,
      appliedStrategy: strategy,
    };
  }

  async createFallbackChain<T>(operation: ProviderOperation<T>): Promise<FallbackChain> {
    if (operation.context) {
      const selectedProvider = await this.smartProviderSelectionService.selectOptimalProvider(
        operation.context,
      );
      const alternativeProviders = await this.getAlternativeProviders(
        selectedProvider,
        operation.context,
      );

      return {
        primaryProvider: selectedProvider,
        fallbackProviders: alternativeProviders.slice(0, ServiceLimits.maxFallbackProviders),
        strategy: this.defaultStrategy,
        context: operation.context,
      };
    }

    const allProviders = Object.keys(this.llmRegistry.getAllProviders());
    const healthyProviders = allProviders.filter((id) =>
      this.providerHealthService.isProviderHealthy(id),
    );

    if (healthyProviders.length === 0) {
      throw new ProviderError(
        "NO_HEALTHY_PROVIDERS",
        "No healthy providers available for fallback",
      );
    }

    return {
      primaryProvider: healthyProviders[0],
      fallbackProviders: healthyProviders.slice(1, 5),
      strategy: this.defaultStrategy,
      context: {} as DeepContextAnalysis,
    };
  }

  private async getAlternativeProviders(
    primaryProviderId: string,
    context: DeepContextAnalysis,
  ): Promise<string[]> {
    const allProviders = Object.keys(this.llmRegistry.getAllProviders());
    const healthyProviders = allProviders.filter(
      (id) => this.providerHealthService.isProviderHealthy(id) && id !== primaryProviderId,
    );

    if (healthyProviders.length === 0) {
      return [];
    }

    const scoredProviders = [];
    for (const providerId of healthyProviders) {
      const score = await this.smartProviderSelectionService.scoreProvider(
        providerId,
        this.smartProviderSelectionService["determineRequirements"](context),
        context,
      );
      scoredProviders.push(score);
    }

    return scoredProviders.sort((a, b) => b.score - a.score).map((score) => score.providerId);
  }

  private shouldRetry(error: ProviderError, strategy: FallbackStrategy): boolean {
    if (strategy.nonRetryableErrors.includes(error.code)) {
      return false;
    }

    if (strategy.retryableErrors.includes(error.code)) {
      return true;
    }

    return false;
  }

  private calculateDelay(attempt: number, strategy: FallbackStrategy): number {
    switch (strategy.type) {
      case "immediate":
        return 0;
      case "linear":
        return Math.min(strategy.baseDelay * attempt, strategy.maxDelay);
      case "exponential":
        return Math.min(strategy.baseDelay * Math.pow(2, attempt - 1), strategy.maxDelay);
      case "adaptive":
        return Math.min(strategy.baseDelay * attempt * 1.5, strategy.maxDelay);
      default:
        return strategy.baseDelay;
    }
  }

  private isProviderAvailable(providerId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(providerId);

    if (!circuitBreaker) {
      return this.providerHealthService.isProviderHealthy(providerId);
    }

    const now = Date.now();

    switch (circuitBreaker.state) {
      case "open":
        if (now >= circuitBreaker.nextAttemptTime) {
          circuitBreaker.state = "half-open";
          this.circuitBreakers.set(providerId, circuitBreaker);
          return true;
        }
        return false;
      case "half-open":
        return true;
      case "closed":
        return true;
      default:
        return false;
    }
  }

  private recordSuccess(providerId: string): void {
    const circuitBreaker = this.circuitBreakers.get(providerId);

    if (circuitBreaker && circuitBreaker.state !== "closed") {
      circuitBreaker.state = "closed";
      circuitBreaker.failureCount = 0;
      this.circuitBreakers.set(providerId, circuitBreaker);

      this.eventBus.publish("circuit-breaker-closed", {
        providerId,
        reason: "Successful operation",
      });
    }
  }

  private recordFailure(providerId: string, error: ProviderError): void {
    const circuitBreaker = this.circuitBreakers.get(providerId) || {
      state: "closed",
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    };

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();

    if (circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreaker.state = "open";
      circuitBreaker.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;

      this.eventBus.publish("circuit-breaker-opened", {
        providerId,
        failureCount: circuitBreaker.failureCount,
        nextAttemptTime: circuitBreaker.nextAttemptTime,
      });
    }

    this.circuitBreakers.set(providerId, circuitBreaker);
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ProviderError("TIMEOUT", `Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getFallbackDelay(providerId: string, attempt: number): number {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (!circuitBreaker) {
      return this.defaultStrategy.baseDelay;
    }

    return this.calculateDelay(attempt, this.defaultStrategy);
  }

  getCircuitBreakerStatus(providerId: string): {
    state: string;
    failureCount: number;
    nextAttemptTime?: number;
  } | null {
    const circuitBreaker = this.circuitBreakers.get(providerId);

    if (!circuitBreaker) {
      return null;
    }

    return {
      state: circuitBreaker.state,
      failureCount: circuitBreaker.failureCount,
      nextAttemptTime: circuitBreaker.state === "open" ? circuitBreaker.nextAttemptTime : undefined,
    };
  }

  resetCircuitBreaker(providerId: string): void {
    this.circuitBreakers.delete(providerId);
    this.eventBus.publish("circuit-breaker-reset", { providerId });
  }

  getAllCircuitBreakerStatuses(): Record<
    string,
    {
      state: string;
      failureCount: number;
      nextAttemptTime?: number;
    }
  > {
    const result: Record<
      string,
      {
        state: string;
        failureCount: number;
        nextAttemptTime?: number;
      }
    > = {};

    for (const [providerId, circuitBreaker] of this.circuitBreakers.entries()) {
      result[providerId] = {
        state: circuitBreaker.state,
        failureCount: circuitBreaker.failureCount,
        nextAttemptTime:
          circuitBreaker.state === "open" ? circuitBreaker.nextAttemptTime : undefined,
      };
    }

    return result;
  }

  updateDefaultStrategy(strategy: Partial<FallbackStrategy>): void {
    this.defaultStrategy = { ...this.defaultStrategy, ...strategy };
    this.eventBus.publish("fallback-strategy-updated", { strategy: this.defaultStrategy });
  }

  getDefaultStrategy(): FallbackStrategy {
    return { ...this.defaultStrategy };
  }
}
