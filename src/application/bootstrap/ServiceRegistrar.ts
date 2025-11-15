import { Container } from "@/container/Container";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService, type ServiceReadinessManager } from "@/infrastructure/services";

export interface ServiceRegistrationConfig {
  key: string;
  factory: () => any;
  lifecycle: "singleton" | "transient" | "lazy";
  tier?: "critical" | "background" | "optional";
  dependencies?: string[];
}

export interface ServiceRegistrationInfo {
  key: string;
  lifecycle: "singleton" | "transient" | "lazy";
  tier?: "critical" | "background" | "optional";
  dependencies: string[];
  registeredAt: number;
}

export class ServiceRegistrar {
  private logger: Logger;
  private registrations = new Map<string, ServiceRegistrationInfo>();

  constructor(
    private container: Container,
    loggingService: LoggingService,
    private readinessManager?: ServiceReadinessManager,
  ) {
    this.logger = createLogger("ServiceRegistrar");
  }

  register(config: ServiceRegistrationConfig): void {
    if (this.registrations.has(config.key)) {
      this.logger.warn("Service already registered", { key: config.key });
      return;
    }

    const dependencies = config.dependencies || [];

    switch (config.lifecycle) {
      case "singleton":
        this.container.registerInstance(config.key, config.factory());
        break;
      case "transient":
        this.container.register(config.key, config.factory);
        break;
      case "lazy":
        this.container.registerLazy(config.key, async () => config.factory());
        break;
    }

    const registrationInfo: ServiceRegistrationInfo = {
      key: config.key,
      lifecycle: config.lifecycle,
      tier: config.tier,
      dependencies,
      registeredAt: Date.now(),
    };

    this.registrations.set(config.key, registrationInfo);

    if (this.readinessManager && config.tier) {
      this.readinessManager.registerService(config.key, config.tier, dependencies);
    }

    this.logger.debug("Service registered", {
      key: config.key,
      lifecycle: config.lifecycle,
      tier: config.tier,
      dependencies: dependencies.length > 0 ? dependencies : undefined,
    });
  }

  registerMany(configs: ServiceRegistrationConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  getRegistration(key: string): ServiceRegistrationInfo | undefined {
    return this.registrations.get(key);
  }

  getAllRegistrations(): ServiceRegistrationInfo[] {
    return Array.from(this.registrations.values());
  }

  getRegistrationsByTier(tier: "critical" | "background" | "optional"): ServiceRegistrationInfo[] {
    return Array.from(this.registrations.values()).filter((reg) => reg.tier === tier);
  }

  getRegistrationsByLifecycle(
    lifecycle: "singleton" | "transient" | "lazy",
  ): ServiceRegistrationInfo[] {
    return Array.from(this.registrations.values()).filter((reg) => reg.lifecycle === lifecycle);
  }

  getDependents(serviceKey: string): string[] {
    const dependents: string[] = [];
    for (const [key, info] of this.registrations.entries()) {
      if (info.dependencies.includes(serviceKey)) {
        dependents.push(key);
      }
    }
    return dependents;
  }

  validateDependencies(serviceKey: string): { valid: boolean; missing: string[] } {
    const registration = this.registrations.get(serviceKey);
    if (!registration) {
      return { valid: false, missing: [] };
    }

    const missing: string[] = [];
    for (const dep of registration.dependencies) {
      if (!this.registrations.has(dep)) {
        missing.push(dep);
      }
    }

    return { valid: missing.length === 0, missing };
  }

  validateAllDependencies(): {
    valid: boolean;
    errors: Array<{ service: string; missing: string[] }>;
  } {
    const errors: Array<{ service: string; missing: string[] }> = [];

    for (const [key] of this.registrations.entries()) {
      const validation = this.validateDependencies(key);
      if (!validation.valid) {
        errors.push({ service: key, missing: validation.missing });
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
