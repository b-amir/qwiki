import type { ProviderScore } from "@/application/services/providers/SmartProviderSelectionService";

export class ProviderRankingService {
  rankProviders(scores: ProviderScore[]): ProviderScore[] {
    return scores.sort((a, b) => {
      const aTotal =
        a.breakdown.performance +
        a.breakdown.cost +
        a.breakdown.quality +
        a.breakdown.speed +
        a.breakdown.reliability;
      const bTotal =
        b.breakdown.performance +
        b.breakdown.cost +
        b.breakdown.quality +
        b.breakdown.speed +
        b.breakdown.reliability;

      if (Math.abs(aTotal - bTotal) > 0.1) {
        return bTotal - aTotal;
      }

      return bTotal - aTotal;
    });
  }
}
