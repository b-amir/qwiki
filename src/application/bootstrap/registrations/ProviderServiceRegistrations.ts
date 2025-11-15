import { Container } from "@/container/Container";
import { LoggingService } from "@/infrastructure/services";
import { ProviderSelectionService } from "@/application/services/providers/ProviderSelectionService";
import { ProviderHealthService } from "@/infrastructure/services/providers/ProviderHealthService";
import { ProviderValidationService } from "@/infrastructure/services/providers/ProviderValidationService";
import { ProviderPerformanceService } from "@/infrastructure/services/providers/ProviderPerformanceService";
import { MetricsCollectionService } from "@/infrastructure/services/performance/MetricsCollectionService";
import { StatisticsCalculationService } from "@/infrastructure/services/performance/StatisticsCalculationService";
import { PerformanceMonitoringService } from "@/infrastructure/services/performance/PerformanceMonitoringService";
import { LLMRegistry } from "@/llm";
import { ContextAnalysisService } from "@/application/services/context/ContextAnalysisService";

export function registerProviderServices(
  container: Container,
  loggingService: LoggingService,
): void {
  container.registerLazy(
    "providerSelectionService",
    async () =>
      new ProviderSelectionService(
        await container.resolveLazy("llmRegistry"),
        container.resolve("eventBus"),
        (await container.resolveLazy("contextAnalysisService")) as ContextAnalysisService,
        await container.resolveLazy("providerHealthService"),
        loggingService,
      ),
  );

  container.registerLazy(
    "providerHealthService",
    async () =>
      new ProviderHealthService(
        await container.resolveLazy("llmRegistry"),
        container.resolve("eventBus"),
        loggingService,
      ),
  );

  container.registerLazy(
    "providerValidationService",
    async () =>
      new ProviderValidationService(
        await container.resolveLazy("llmRegistry"),
        container.resolve("configurationManager"),
        container.resolve("apiKeyRepository"),
        loggingService,
      ),
  );

  container.registerLazy("providerPerformanceService", async () => {
    const metricsCollectionService = new MetricsCollectionService(
      container.resolve("eventBus"),
      loggingService,
    );
    const statisticsCalculationService = new StatisticsCalculationService(
      await container.resolveLazy("llmRegistry"),
      loggingService,
    );
    const performanceMonitoringService = new PerformanceMonitoringService(
      container.resolve("eventBus"),
      loggingService,
    );

    return new ProviderPerformanceService(
      await container.resolveLazy("llmRegistry"),
      container.resolve("eventBus"),
      metricsCollectionService,
      statisticsCalculationService,
      performanceMonitoringService,
      loggingService,
    );
  });
}
