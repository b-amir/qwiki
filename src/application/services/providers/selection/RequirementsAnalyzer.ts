import type { DeepContextAnalysis } from "@/application/services/context/ContextAnalysisService";
import {
  PatternType,
  RelationshipType,
} from "@/application/services/context/ContextAnalysisService";
import { ProviderFeature } from "@/llm/types/ProviderCapabilities";
import type { ContextualRequirements } from "@/application/services/providers/SmartProviderSelectionService";

export class RequirementsAnalyzer {
  determineRequirements(context: DeepContextAnalysis): ContextualRequirements {
    const requiredFeatures: ProviderFeature[] = [];
    const complexity = context.complexity.overall;

    if (context.patterns.some((p: any) => p.type === PatternType.FUNCTION_DECLARATION)) {
      requiredFeatures.push(ProviderFeature.FUNCTION_CALLING);
    }

    if (context.patterns.some((p: any) => p.type === PatternType.CLASS_DECLARATION)) {
      requiredFeatures.push(ProviderFeature.CODE_ANALYSIS);
    }

    if (context.patterns.some((p: any) => p.type === PatternType.INTERFACE_DECLARATION)) {
      requiredFeatures.push(ProviderFeature.MULTI_LANGUAGE);
    }

    if (
      context.relationships.some(
        (r: any) => r.type === RelationshipType.INHERITS || r.type === RelationshipType.IMPLEMENTS,
      )
    ) {
      requiredFeatures.push(ProviderFeature.CONTEXT_AWARENESS);
    }

    const minTokens = complexity > 0.7 ? 4000 : complexity > 0.4 ? 2000 : 1000;
    const requiresStreaming = complexity > 0.5;
    const requiresFunctionCalling = complexity > 0.6;
    const minContextWindow = complexity > 0.8 ? 16000 : 8000;

    let domain: "general" | "technical" | "scientific" | "business" = "general";
    if (context.patterns.some((p: any) => p.confidence > 0.8 && p.name.includes("API"))) {
      domain = "technical";
    } else if (
      context.patterns.some((p: any) => p.confidence > 0.8 && p.name.includes("Database"))
    ) {
      domain = "business";
    } else if (
      context.patterns.some((p: any) => p.confidence > 0.8 && p.name.includes("Algorithm"))
    ) {
      domain = "scientific";
    }

    let complexityType: "simple" | "moderate" | "complex";
    if (complexity <= 0.3) {
      complexityType = "simple";
    } else if (complexity <= 0.7) {
      complexityType = "moderate";
    } else {
      complexityType = "complex";
    }

    return {
      requiredFeatures,
      minTokens,
      preferredLanguages: [context.language],
      requiresStreaming,
      requiresFunctionCalling,
      minContextWindow,
      complexity: complexityType,
      domain,
    };
  }
}
