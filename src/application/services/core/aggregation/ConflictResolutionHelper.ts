import type { SavedWiki } from "@/application/services/storage/WikiStorageService";
import type {
  ContentConflict,
  ConflictResolutionStrategy,
  ResolvedConflict,
} from "@/domain/entities/WikiAggregation";

export class ConflictResolutionHelper {
  async detectContentConflicts(wikis: SavedWiki[]): Promise<ContentConflict[]> {
    const conflicts: ContentConflict[] = [];

    for (let i = 0; i < wikis.length; i++) {
      for (let j = i + 1; j < wikis.length; j++) {
        const conflict = this.detectConflict(wikis[i], wikis[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  async resolveConflicts(
    conflicts: ContentConflict[],
    strategy: ConflictResolutionStrategy,
  ): Promise<ResolvedConflict[]> {
    const resolved: ResolvedConflict[] = [];

    for (const conflict of conflicts) {
      let resolution = "";
      let resolvedContent = "";

      switch (conflict.conflictType) {
        case "duplicate":
          if (strategy.onDuplicate === "keep-first") {
            resolution = "Keeping first occurrence";
            resolvedContent = conflict.conflictingContent;
          } else if (strategy.onDuplicate === "keep-latest") {
            resolution = "Keeping latest occurrence";
            resolvedContent = conflict.conflictingContent;
          } else if (strategy.onDuplicate === "mark") {
            resolution = "Marked as duplicate";
            resolvedContent = `<!-- DUPLICATE: ${conflict.conflictingContent} -->`;
          }
          break;
        case "contradictory":
          if (strategy.onContradictory === "mark-both") {
            resolution = "Marked both as contradictory";
            resolvedContent = `<!-- CONTRADICTION: ${conflict.conflictingContent} -->`;
          }
          break;
        case "overlapping":
          if (strategy.onOverlapping === "separate") {
            resolution = "Kept as separate sections";
            resolvedContent = conflict.conflictingContent;
          }
          break;
      }

      resolved.push({ conflict, resolution, resolvedContent });
    }

    return resolved;
  }

  private detectConflict(wiki1: SavedWiki, wiki2: SavedWiki): ContentConflict | null {
    const content1 = wiki1.content.toLowerCase();
    const content2 = wiki2.content.toLowerCase();

    const similarity = this.calculateSimilarity(content1, content2);

    if (similarity > 0.9) {
      return {
        wikiId: wiki1.id,
        wikiTitle: wiki1.title,
        conflictType: "duplicate",
        conflictingContent: wiki1.content.substring(0, 200),
        conflictingWikis: [wiki2.id],
      };
    }

    if (similarity > 0.7) {
      return {
        wikiId: wiki1.id,
        wikiTitle: wiki1.title,
        conflictType: "overlapping",
        conflictingContent: wiki1.content.substring(0, 200),
        conflictingWikis: [wiki2.id],
      };
    }

    return null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}
