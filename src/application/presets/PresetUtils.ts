import type { ConfigurationTemplate } from "@/domain/configuration";
import { createDevelopmentPreset } from "@/application/presets/DevelopmentPreset";
import { createProductionPreset } from "@/application/presets/ProductionPreset";
import { createEnterprisePreset } from "@/application/presets/EnterprisePreset";
import { createHighPerformancePreset } from "@/application/presets/HighPerformancePreset";
import { createCostOptimizedPreset } from "@/application/presets/CostOptimizedPreset";
import { createMultiProviderPreset } from "@/application/presets/MultiProviderPreset";

export function getAllPresets(): ConfigurationTemplate[] {
  return [
    createDevelopmentPreset(),
    createProductionPreset(),
    createEnterprisePreset(),
    createHighPerformancePreset(),
    createCostOptimizedPreset(),
    createMultiProviderPreset(),
  ];
}

export function getPresetById(id: string): ConfigurationTemplate | undefined {
  const presets = getAllPresets();
  return presets.find((preset) => preset.id === id);
}

export function getPresetsByCategory(category: string): ConfigurationTemplate[] {
  const presets = getAllPresets();
  return presets.filter((preset) => preset.category === category);
}

export function getRecommendedPreset(
  usage: "development" | "production" | "enterprise" | "cost-sensitive" | "performance",
): ConfigurationTemplate {
  switch (usage) {
    case "development":
      return createDevelopmentPreset();
    case "production":
      return createProductionPreset();
    case "enterprise":
      return createEnterprisePreset();
    case "cost-sensitive":
      return createCostOptimizedPreset();
    case "performance":
      return createHighPerformancePreset();
    default:
      return createDevelopmentPreset();
  }
}
