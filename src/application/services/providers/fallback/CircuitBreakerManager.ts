import { EventBus } from "@/events/EventBus";
import { ProviderHealthService } from "@/infrastructure/services/providers/ProviderHealthService";
import { ProviderError } from "@/errors/ProviderError";

interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class CircuitBreakerManager {
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000;
  private readonly CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT = 30000;

  constructor(
    private providerHealthService: ProviderHealthService,
    private eventBus: EventBus,
  ) {}

  isProviderAvailable(providerId: string): boolean {
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

  recordSuccess(providerId: string): void {
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

  recordFailure(providerId: string, error: ProviderError): void {
    const circuitBreaker = this.circuitBreakers.get(providerId) || {
      state: "closed" as const,
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
}
