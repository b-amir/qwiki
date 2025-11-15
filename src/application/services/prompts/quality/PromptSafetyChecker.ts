import type { SafetyCheck, AmbiguityAnalysis } from "@/domain/entities/PromptEngineering";

export class PromptSafetyChecker {
  checkForHarmfulInstructions(prompt: string): SafetyCheck {
    const harmfulPatterns = [
      /ignore\s+(errors|warnings|safety|security)/i,
      /bypass\s+(security|validation|checks)/i,
      /disable\s+(safety|security|validation)/i,
      /skip\s+(validation|checks|safety)/i,
    ];

    const harmfulPatternsFound: string[] = [];
    for (const pattern of harmfulPatterns) {
      if (pattern.test(prompt)) {
        harmfulPatternsFound.push(pattern.toString());
      }
    }

    const warnings: string[] = [];
    if (harmfulPatternsFound.length > 0) {
      warnings.push("Prompt may encourage unsafe practices");
    }

    return {
      isSafe: harmfulPatternsFound.length === 0,
      harmfulPatterns: harmfulPatternsFound,
      warnings,
    };
  }

  analyzePromptAmbiguity(prompt: string): AmbiguityAnalysis {
    const ambiguousPatterns = [
      /\b(may|might|could|possibly|perhaps|maybe)\b/gi,
      /\b(some|any|thing|stuff|something|anything)\b/gi,
      /\b(etc|and so on|and more)\b/gi,
    ];

    const ambiguousTerms: string[] = [];
    for (const pattern of ambiguousPatterns) {
      const matches = prompt.match(pattern);
      if (matches) ambiguousTerms.push(...matches);
    }

    const uniqueTerms = [...new Set(ambiguousTerms)];
    const score = Math.max(0, 1.0 - uniqueTerms.length * 0.1);

    return {
      ambiguousTerms: uniqueTerms,
      score,
      issues: uniqueTerms.length > 0 ? [`Found ${uniqueTerms.length} ambiguous term(s)`] : [],
    };
  }
}
