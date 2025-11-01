import { EventBus } from "../../events/EventBus";
import { SmartProviderSelectionService } from "./SmartProviderSelectionService";
import { ProviderFallbackManager } from "./ProviderFallbackManager";
import { ProviderHealthService } from "../../infrastructure/services/ProviderHealthService";
import { LLMRegistry as ProvidersRegistry } from "../../llm/providers/registry";
import { LLMRegistry as IndexRegistry } from "../../llm";
import { ContextAnalysisService } from "./ContextAnalysisService";
import { DeepContextAnalysis } from "./ContextAnalysisService";
import { ProviderSelectionService } from "./ProviderSelectionService";
import { LoggingService } from "../../infrastructure/services/LoggingService";

export class ProviderSelectionIntegrationService {
  private smartProviderSelectionService: SmartProviderSelectionService;
  private providerFallbackManager: ProviderFallbackManager;
  private providerSelectionService: ProviderSelectionService;
  private readonly serviceName = "ProviderSelectionIntegrationService";

  constructor(
    private llmRegistry: IndexRegistry,
    private eventBus: EventBus,
    private loggingService: LoggingService = new LoggingService({
      enabled: false,
      level: "error",
      includeTimestamp: true,
      includeService: true,
    }),
  ) {
    const providersRegistry = this.llmRegistry as any as ProvidersRegistry;

    const providerHealthService = new ProviderHealthService(this.llmRegistry, this.eventBus);
    const contextAnalysisService = new ContextAnalysisService(this.eventBus, this.loggingService);
    this.providerSelectionService = new ProviderSelectionService(
      providersRegistry,
      this.eventBus,
    );
    this.smartProviderSelectionService = new SmartProviderSelectionService(
      this.providerSelectionService,
      contextAnalysisService,
      providersRegistry,
      this.eventBus,
    );
    this.providerFallbackManager = new ProviderFallbackManager(
      this.smartProviderSelectionService,
      providerHealthService,
      providersRegistry,
      this.eventBus,
    );
  }

  async selectOptimalProvider(context: DeepContextAnalysis, criteria?: any): Promise<string> {
    return await this.smartProviderSelectionService.selectOptimalProvider(context, criteria);
  }

  async executeWithFallback<T>(operation: any, customStrategy?: any): Promise<any> {
    return await this.providerFallbackManager.executeWithFallback(operation, customStrategy);
  }

  async getFallbackChain(primaryProvider: string, context: DeepContextAnalysis): Promise<any> {
    return await this.providerFallbackManager.createFallbackChain({
      execute: (providerId: string) => Promise.resolve(providerId),
      context,
    });
  }

  getFallbackDelay(providerId: string, attempt: number): number {
    return this.providerFallbackManager.getFallbackDelay(providerId, attempt);
  }

  getCircuitBreakerStatus(providerId: string): any {
    return this.providerFallbackManager.getCircuitBreakerStatus(providerId);
  }

  resetCircuitBreaker(providerId: string): void {
    this.providerFallbackManager.resetCircuitBreaker(providerId);
  }

  async getProviderRanking(providerId: string): Promise<any> {
    this.loggingService.debug(
      this.serviceName,
      "getProviderRanking called for provider",
      providerId,
    );
    this.loggingService.debug(
      this.serviceName,
      "Available methods on smartProviderSelectionService",
      Object.getOwnPropertyNames(Object.getPrototypeOf(this.smartProviderSelectionService)),
    );

    if (typeof this.smartProviderSelectionService["determineRequirements"] !== "function") {
      this.loggingService.error(
        this.serviceName,
        "determineRequirements method does not exist or is not accessible",
      );
      return {
        providerId,
        score: 0,
        stats: { error: "determineRequirements method not available" },
      };
    }

    const score = await this.smartProviderSelectionService.scoreProvider(
      providerId,
      this.smartProviderSelectionService["determineRequirements"]({} as DeepContextAnalysis),
      {} as DeepContextAnalysis,
    );
    return {
      providerId,
      score: score.score,
      stats: score.breakdown,
    };
  }

  async explainSelection(
    selectedProvider: string,
    alternatives: any[],
    context: DeepContextAnalysis,
  ): Promise<string> {
    return await this.smartProviderSelectionService.explainSelection(
      selectedProvider,
      alternatives,
      context,
    );
  }

  updateDefaultFallbackStrategy(strategy: any): void {
    this.providerFallbackManager.updateDefaultStrategy(strategy);
  }

  getDefaultFallbackStrategy(): any {
    return this.providerFallbackManager.getDefaultStrategy();
  }
}
