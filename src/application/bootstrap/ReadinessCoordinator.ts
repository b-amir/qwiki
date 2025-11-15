import { ServiceReadinessManager } from "@/infrastructure/services/ServiceReadinessManager";
import { SERVICE_TIERS, COMMAND_REQUIREMENTS } from "@/constants/ServiceTiers";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";

export class ReadinessCoordinator {
  private logger: Logger;

  constructor(
    private readinessManager: ServiceReadinessManager,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("ReadinessCoordinator");
  }

  registerTiers(): void {
    for (const [serviceId, config] of Object.entries(SERVICE_TIERS)) {
      this.readinessManager.registerService(serviceId, config.tier, []);
    }

    this.logger.debug("Service tiers registered", {
      count: Object.keys(SERVICE_TIERS).length,
    });
  }

  registerCommandRequirements(): void {
    for (const requirement of COMMAND_REQUIREMENTS) {
      this.readinessManager.registerCommandRequirements(requirement);
    }

    this.logger.debug("Command requirements registered", {
      count: COMMAND_REQUIREMENTS.length,
    });
  }
}
