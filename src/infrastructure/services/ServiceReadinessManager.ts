import { EventEmitter } from "events";
import type { Disposable } from "vscode";

export interface ServiceMetadata {
  initDuration: number;
  version?: string;
  capabilities?: string[];
}

export type ServiceTier = "critical" | "background" | "optional";
export type ServiceStatus = "pending" | "initializing" | "ready" | "failed";

export interface ServiceState {
  id: string;
  tier: ServiceTier;
  status: ServiceStatus;
  dependencies: string[];
  metadata?: ServiceMetadata;
  error?: Error;
  initStartTime?: number;
  initEndTime?: number;
}

export interface CommandRequirements {
  commandId: string;
  requiredServices: string[];
  optionalServices: string[];
  fallbackBehavior?: "queue" | "degrade" | "fail";
}

export class ServiceReadinessManager {
  private services = new Map<string, ServiceState>();
  private commandRequirements = new Map<string, CommandRequirements>();
  private eventEmitter = new EventEmitter();

  /**
   * Register a service with its tier and dependencies
   */
  registerService(serviceId: string, tier: ServiceTier, dependencies: string[] = []): void {
    this.services.set(serviceId, {
      id: serviceId,
      tier,
      status: "pending",
      dependencies,
    });
  }

  /**
   * Register command requirements
   */
  registerCommandRequirements(requirements: CommandRequirements): void {
    this.commandRequirements.set(requirements.commandId, requirements);
  }

  /**
   * Mark a service as initializing
   */
  markInitializing(serviceId: string): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.status = "initializing";
      service.initStartTime = Date.now();
      this.services.set(serviceId, service);
    }
  }

  /**
   * Mark a service as ready
   */
  markReady(serviceId: string, metadata?: ServiceMetadata): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.status = "ready";
      service.initEndTime = Date.now();
      service.metadata = metadata;
      this.services.set(serviceId, service);
      this.eventEmitter.emit(`service:ready:${serviceId}`);
      this.eventEmitter.emit("service:ready", serviceId);

      // Check if all critical services are ready
      if (this.areAllCriticalServicesReady()) {
        this.eventEmitter.emit("critical:ready");
      }
    }
  }

  /**
   * Mark a service as failed
   */
  markFailed(serviceId: string, error: Error): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.status = "failed";
      service.error = error;
      service.initEndTime = Date.now();
      this.services.set(serviceId, service);
      this.eventEmitter.emit(`service:failed:${serviceId}`, error);
      this.eventEmitter.emit("service:failed", { serviceId, error });
    }
  }

  /**
   * Check if a service is ready
   */
  isReady(serviceId: string): boolean {
    const service = this.services.get(serviceId);
    return service?.status === "ready";
  }

  /**
   * Wait for a service to be ready (with timeout)
   */
  waitForService(serviceId: string, timeoutMs: number): Promise<boolean> {
    if (this.isReady(serviceId)) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);

      const readyHandler = () => {
        cleanup();
        resolve(true);
      };

      const failedHandler = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.eventEmitter.off(`service:ready:${serviceId}`, readyHandler);
        this.eventEmitter.off(`service:failed:${serviceId}`, failedHandler);
      };

      this.eventEmitter.once(`service:ready:${serviceId}`, readyHandler);
      this.eventEmitter.once(`service:failed:${serviceId}`, failedHandler);
    });
  }

  /**
   * Get all services required for a command
   */
  getRequiredServices(commandId: string): string[] {
    const requirements = this.commandRequirements.get(commandId);
    return requirements?.requiredServices || [];
  }

  /**
   * Check if all required services for a command are ready
   */
  canExecuteCommand(commandId: string): boolean {
    const requiredServices = this.getRequiredServices(commandId);
    return requiredServices.every((serviceId) => this.isReady(serviceId));
  }

  /**
   * Get initialization progress (0-100)
   */
  getProgress(): number {
    if (this.services.size === 0) {
      return 0;
    }

    const readyCount = Array.from(this.services.values()).filter(
      (s) => s.status === "ready",
    ).length;

    return Math.round((readyCount / this.services.size) * 100);
  }

  /**
   * Check if all critical services are ready
   */
  areAllCriticalServicesReady(): boolean {
    const criticalServices = Array.from(this.services.values()).filter(
      (s) => s.tier === "critical",
    );

    if (criticalServices.length === 0) {
      return false;
    }

    return criticalServices.every((s) => s.status === "ready");
  }

  /**
   * Get service state
   */
  getServiceState(serviceId: string): ServiceState | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get all services by tier
   */
  getServicesByTier(tier: ServiceTier): ServiceState[] {
    return Array.from(this.services.values()).filter((s) => s.tier === tier);
  }

  /**
   * Subscribe to readiness events
   */
  onServiceReady(serviceId: string, callback: () => void): Disposable {
    this.eventEmitter.on(`service:ready:${serviceId}`, callback);
    return {
      dispose: () => {
        this.eventEmitter.off(`service:ready:${serviceId}`, callback);
      },
    };
  }

  onAllCriticalReady(callback: () => void): Disposable {
    this.eventEmitter.on("critical:ready", callback);
    return {
      dispose: () => {
        this.eventEmitter.off("critical:ready", callback);
      },
    };
  }

  /**
   * Subscribe to background progress events
   */
  onBackgroundProgress(callback: (progress: number) => void): Disposable {
    const handler = () => {
      const backgroundServices = this.getServicesByTier("background");
      const readyCount = backgroundServices.filter((s) => s.status === "ready").length;
      const progress =
        backgroundServices.length > 0
          ? Math.round((readyCount / backgroundServices.length) * 100)
          : 100;
      callback(progress);
    };

    this.eventEmitter.on("service:ready", handler);
    return {
      dispose: () => {
        this.eventEmitter.off("service:ready", handler);
      },
    };
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    this.eventEmitter.removeAllListeners();
    this.services.clear();
    this.commandRequirements.clear();
  }
}
