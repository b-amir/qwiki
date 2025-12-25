import { SmartProviderSelectionService } from "@/application/services/providers/SmartProviderSelectionService";
import { ProviderHealthService } from "@/infrastructure/services/providers/ProviderHealthService";
import { LLMRegistry } from "@/llm/providers/registry";
import { ProviderError } from "@/errors/ProviderError";
import type { DeepContextAnalysis } from "@/application/services/context/ContextAnalysisService";
import { ServiceLimits } from "@/constants";
import type {
  FallbackChain,
  FallbackStrategy,
  ProviderOperation,
} from "../ProviderFallbackManagerService";

export class FallbackChainBuilder {
  constructor(
    private smartProviderSelectionService: SmartProviderSelectionService,
    private providerHealthService: ProviderHealthService,
    private llmRegistry: LLMRegistry,
    private defaultStrategy: FallbackStrategy,
  ) {}

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
      primaryProvider: healthyProviders[0]!,
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
      const requirements = (
        this.smartProviderSelectionService as any
      ).requirementsAnalyzer.determineRequirements(context);
      const score = await this.smartProviderSelectionService.scoreProvider(
        providerId,
        requirements,
        context,
      );
      scoredProviders.push(score);
    }

    return scoredProviders.sort((a, b) => b.score - a.score).map((score) => score.providerId);
  }
}
