import { EventBus } from "@/events/EventBus";
import { LLMRegistry } from "@/llm/providers/registry";

export class ProviderPerformanceTracker {
  constructor(
    private llmRegistry: LLMRegistry,
    private eventBus: EventBus,
  ) {}

  async getProviderPerformance(
    providerId: string,
  ): Promise<{ averageResponseTime: number; successRate: number } | null> {
    const provider = this.llmRegistry.getProvider(providerId);
    if (!provider) {
      return { averageResponseTime: 1000, successRate: 0.5 };
    }

    return {
      averageResponseTime: 500,
      successRate: 0.9,
    };
  }

  async learnFromSelectionOutcomes(
    selections: Array<{ providerId: string; outcome: "success" | "failure" | "timeout" }>,
  ): Promise<void> {
    for (const selection of selections) {
      const provider = this.llmRegistry.getProvider(selection.providerId);
      if (!provider) continue;

      const currentScore = await this.getProviderScore(selection.providerId);
      const adjustment =
        selection.outcome === "success" ? 5 : selection.outcome === "failure" ? -10 : -2;

      await this.updateProviderScore(selection.providerId, currentScore + adjustment);
    }
  }

  private async getProviderScore(providerId: string): Promise<number> {
    return new Promise((resolve) => {
      this.eventBus.publish("provider-score-requested", { providerId });

      this.eventBus.subscribe(
        "provider-score-response",
        (response: { providerId: string; score: number }) => {
          if (response.providerId === providerId) {
            resolve(response.score);
          }
        },
      );

      setTimeout(() => resolve(50), 5000);
    });
  }

  private async updateProviderScore(providerId: string, newScore: number): Promise<void> {
    this.eventBus.publish("provider-score-updated", { providerId, newScore });
  }
}
