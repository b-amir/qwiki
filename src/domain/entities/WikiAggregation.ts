import type { SavedWiki } from "../../application/services/WikiStorageService";

export interface WikiAggregation {
  id: string;
  title: string;
  wikis: SavedWiki[];
  metadata: AggregationMetadata;
  createdAt: Date;
  updatedAt?: Date;
}

export interface AggregationMetadata {
  totalWikis: number;
  totalSize: number;
  languages: string[];
  tags: string[];
  relationships?: WikiRelationship[];
}

export interface AggregationConfig {
  includeSummaries: boolean;
  mergeStrategy: MergeStrategy;
  outputFormat: "markdown" | "html" | "json";
}

export type MergeStrategy =
  | "sequential"
  | "categorical"
  | "chronological"
  | "alphabetical"
  | "custom";

export interface WikiRelationship {
  sourceWiki: string;
  targetWiki: string;
  relationshipType: RelationshipType;
  strength: number;
}

export type RelationshipType =
  | "imports"
  | "references"
  | "extends"
  | "implements"
  | "uses"
  | "depends-on"
  | "related";

export interface CrossReferenceMap {
  [wikiId: string]: CrossReference[];
}

export interface CrossReference {
  targetWikiId: string;
  targetTitle: string;
  relationshipType: RelationshipType;
  location: string;
}

export interface ContentConflict {
  wikiId: string;
  wikiTitle: string;
  conflictType: ConflictType;
  conflictingContent: string;
  conflictingWikis: string[];
}

export type ConflictType = "duplicate" | "contradictory" | "overlapping" | "outdated";

export interface ConflictResolutionStrategy {
  onDuplicate: "keep-first" | "keep-latest" | "merge" | "mark";
  onContradictory: "keep-first" | "keep-latest" | "mark-both" | "user-choice";
  onOverlapping: "merge" | "separate" | "prioritize";
}

export interface ResolvedConflict {
  conflict: ContentConflict;
  resolution: string;
  resolvedContent: string;
}

export interface OptimizedStructure {
  sections: StructureSection[];
  hierarchy: HierarchyNode[];
  navigation: NavigationItem[];
}

export interface StructureSection {
  name: string;
  wikis: string[];
  order: number;
  description?: string;
}

export interface HierarchyNode {
  id: string;
  title: string;
  level: number;
  children: HierarchyNode[];
  wikiIds: string[];
}

export interface NavigationItem {
  title: string;
  wikiId?: string;
  sectionId?: string;
  level: number;
  order: number;
}

export interface AggregationChanges {
  addedWikis?: string[];
  removedWikis?: string[];
  title?: string;
  config?: Partial<AggregationConfig>;
}
