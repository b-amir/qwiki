import { Container } from "@/container/Container";
import { ServiceReadinessManager } from "@/infrastructure/services/ServiceReadinessManager";
import { createLogger, type Logger } from "@/infrastructure/services";
import { LoggingService } from "@/infrastructure/services";
import { CriticalServicesInitializer } from "@/application/bootstrap/initializers/CriticalServicesInitializer";
import { BackgroundServicesInitializer } from "@/application/bootstrap/initializers/BackgroundServicesInitializer";

export interface InitializationProgress {
  phase: "critical" | "background";
  completed: number;
  total: number;
  percent: number;
  failed: number;
  errors: Array<{ service: string; error: Error }>;
}

const CRITICAL_INIT_TIMEOUT = 10000;
const BACKGROUND_INIT_TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 2;

export class InitializationOrchestrator {
  private logger: Logger;
  private criticalInitErrors: Array<{ service: string; error: Error }> = [];
  private backgroundInitErrors: Array<{ service: string; error: Error }> = [];

  constructor(
    private container: Container,
    private readinessManager: ServiceReadinessManager,
    loggingService: LoggingService,
  ) {
    this.logger = createLogger("InitializationOrchestrator");
  }

  async initializeCriticalServices(): Promise<void> {
    const startTime = Date.now();
    this.logger.info("Starting critical services initialization");

    try {
      const initializer = new CriticalServicesInitializer(
        this.container,
        this.readinessManager,
        this.container.resolve("loggingService") as LoggingService,
      );

      const initPromise = initializer.initialize();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Critical services initialization timed out after ${CRITICAL_INIT_TIMEOUT}ms`,
            ),
          );
        }, CRITICAL_INIT_TIMEOUT);
      });

      await Promise.race([initPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      this.logger.info("Critical services initialized", { duration });

      if (duration > 500) {
        this.logger.warn("Critical init exceeded 500ms target", { duration });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const initError = error instanceof Error ? error : new Error(String(error));

      this.criticalInitErrors.push({
        service: "critical",
        error: initError,
      });

      this.logger.error("Critical services initialization failed", {
        error: initError,
        duration,
        attempt: 1,
      });

      throw initError;
    }
  }

  async initializeBackgroundServices(): Promise<void> {
    this.logger.info("Starting background services initialization");
    const startTime = Date.now();

    const initializer = new BackgroundServicesInitializer(
      this.container,
      this.readinessManager,
      this.container.resolve("loggingService") as LoggingService,
    );

    try {
      const initPromise = initializer.initialize();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Background services initialization timed out after ${BACKGROUND_INIT_TIMEOUT}ms`,
            ),
          );
        }, BACKGROUND_INIT_TIMEOUT);
      });

      await Promise.race([initPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      this.logger.info("Background services initialized", { duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      const initError = error instanceof Error ? error : new Error(String(error));

      this.backgroundInitErrors.push({
        service: "background",
        error: initError,
      });

      this.logger.error("Background initialization failed", {
        error: initError,
        duration,
      });

      throw initError;
    }
  }

  getCriticalInitErrors(): Array<{ service: string; error: Error }> {
    return [...this.criticalInitErrors];
  }

  getBackgroundInitErrors(): Array<{ service: string; error: Error }> {
    return [...this.backgroundInitErrors];
  }

  getAllErrors(): Array<{ service: string; error: Error }> {
    return [...this.criticalInitErrors, ...this.backgroundInitErrors];
  }

  getProgress(): InitializationProgress {
    const criticalServices = this.readinessManager.getServicesByTier("critical");
    const backgroundServices = this.readinessManager.getServicesByTier("background");

    const criticalReady = criticalServices.filter((s) => s.status === "ready").length;
    const criticalFailed = criticalServices.filter((s) => s.status === "failed").length;

    const backgroundReady = backgroundServices.filter((s) => s.status === "ready").length;
    const backgroundFailed = backgroundServices.filter((s) => s.status === "failed").length;

    const criticalTotal = criticalServices.length;
    const backgroundTotal = backgroundServices.length;

    const criticalProgress =
      criticalTotal > 0
        ? {
            phase: "critical" as const,
            completed: criticalReady,
            total: criticalTotal,
            percent: Math.round((criticalReady / criticalTotal) * 100),
            failed: criticalFailed,
            errors: this.criticalInitErrors,
          }
        : {
            phase: "critical" as const,
            completed: 0,
            total: 0,
            percent: 100,
            failed: 0,
            errors: [],
          };

    const backgroundProgress =
      backgroundTotal > 0
        ? {
            phase: "background" as const,
            completed: backgroundReady,
            total: backgroundTotal,
            percent: Math.round((backgroundReady / backgroundTotal) * 100),
            failed: backgroundFailed,
            errors: this.backgroundInitErrors,
          }
        : {
            phase: "background" as const,
            completed: 0,
            total: 0,
            percent: 100,
            failed: 0,
            errors: [],
          };

    if (criticalTotal > 0 && criticalProgress.percent < 100) {
      return criticalProgress;
    }

    return backgroundProgress;
  }
}
