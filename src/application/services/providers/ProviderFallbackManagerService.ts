import { EventBus } from "@/events/EventBus";
import { SmartProviderSelectionService } from "@/application/services/providers/SmartProviderSelectionService";
import { ProviderHealthService } from "@/infrastructure/services";
import { LLMRegistry } from "@/llm/providers/registry";
import { ProviderError } from "@/errors/ProviderError";
import type { DeepContextAnalysis } from "@/application/services/context/ContextAnalysisService";
import { ServiceLimits } from "@/constants";
import { LoggingService, createLogger, type Logger } from "@/infrastructure/services";
import { FallbackChainBuilder } from "@/application/services/providers/fallback/FallbackChainBuilder";
import { CircuitBreakerManager } from "@/application/services/providers/fallback/CircuitBreakerManager";
import { RetryStrategyCalculator } from "@/application/services/providers/fallback/RetryStrategyCalculator";
import { FallbackExecutor } from "@/application/services/providers/fallback/FallbackExecutor";

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

  private chainBuilder: FallbackChainBuilder;
  private circuitBreakerManager: CircuitBreakerManager;
  private retryCalculator: RetryStrategyCalculator;
  private executor: FallbackExecutor;
  private logger: Logger;

  constructor(
    private smartProviderSelectionService: SmartProviderSelectionService,
    private providerHealthService: ProviderHealthService,
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
    private loggingService: LoggingService,
  ) {
    this.logger = createLogger("ProviderFallbackManagerService");
    this.circuitBreakerManager = new CircuitBreakerManager(
      this.providerHealthService,
      this.eventBus,
    );
    this.retryCalculator = new RetryStrategyCalculator();
    this.executor = new FallbackExecutor(this.circuitBreakerManager, this.retryCalculator);
    this.chainBuilder = new FallbackChainBuilder(
      this.smartProviderSelectionService,
      this.providerHealthService,
      this.llmRegistry,
      this.defaultStrategy,
    );
  }

  async executeWithFallback<T>(
    operation: ProviderOperation<T>,
    customStrategy?: Partial<FallbackStrategy>,
  ): Promise<FallbackResult<T>> {
    const strategy = { ...this.defaultStrategy, ...customStrategy };

    this.logger.debug("Executing operation with fallback", {
      strategy: strategy.type,
      maxAttempts: strategy.maxAttempts,
    });

    const fallbackChain = await this.chainBuilder.createFallbackChain(operation);

    this.eventBus.publish("provider-skipped", {
      providerId: fallbackChain.primaryProvider,
      reason: "Circuit breaker is open or provider is unhealthy",
    });

    return this.executor.executeWithFallback(operation, fallbackChain, strategy);
  }

  getFallbackDelay(providerId: string, attempt: number): number {
    return this.retryCalculator.calculateDelay(attempt, this.defaultStrategy);
  }

  getCircuitBreakerStatus(providerId: string): {
    state: string;
    failureCount: number;
    nextAttemptTime?: number;
  } | null {
    return this.circuitBreakerManager.getCircuitBreakerStatus(providerId);
  }

  resetCircuitBreaker(providerId: string): void {
    this.circuitBreakerManager.resetCircuitBreaker(providerId);
  }

  getAllCircuitBreakerStatuses(): Record<
    string,
    {
      state: string;
      failureCount: number;
      nextAttemptTime?: number;
    }
  > {
    return this.circuitBreakerManager.getAllCircuitBreakerStatuses();
  }

  updateDefaultStrategy(strategy: Partial<FallbackStrategy>): void {
    this.defaultStrategy = { ...this.defaultStrategy, ...strategy };
    this.chainBuilder = new FallbackChainBuilder(
      this.smartProviderSelectionService,
      this.providerHealthService,
      this.llmRegistry,
      this.defaultStrategy,
    );
    this.eventBus.publish("fallback-strategy-updated", { strategy: this.defaultStrategy });
  }

  getDefaultStrategy(): FallbackStrategy {
    return { ...this.defaultStrategy };
  }
}
