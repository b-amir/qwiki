import type { WikiPage, WikiIndex } from './WikiTypes'

export interface AggregationStrategy {
  id: string
  name: string
  type: AggregationType
  rules: AggregationRule[]
  mergeStrategy: MergeStrategy
  conflictResolution: ConflictResolutionStrategy
  priority: number
  enabled: boolean
}

export interface AggregationRule {
  id: string
  condition: string
  action: AggregationAction
  priority: number
  enabled: boolean
}

export interface AggregatedWiki {
  id: string
  projectId: string
  name: string
  pages: WikiPage[]
  structure: WikiStructure
  index: WikiIndex
  metadata: AggregatedWikiMetadata
  createdAt: Date
  updatedAt: Date
}

export interface AggregationResult {
  success: boolean
  wiki: AggregatedWiki | null
  statistics: AggregationStatistics
  issues: AggregationIssue[]
  warnings: AggregationWarning[]
  duration: number
}

export interface AggregationStatistics {
  totalPages: number
  totalCategories: number
  totalTags: number
  duplicatesFound: number
  conflictsResolved: number
  pagesMerged: number
  pagesAdded: number
  pagesRemoved: number
}

export interface AggregationIssue {
  type: IssueType
  severity: IssueSeverity
  message: string
  pageIds?: string[]
  suggestedAction?: string
}

export interface AggregationWarning {
  type: WarningType
  message: string
  pageIds?: string[]
  recommendation?: string
}

export interface WikiStructure {
  hierarchy: WikiHierarchyNode[]
  categories: WikiCategory[]
  relationships: WikiRelationshipMap
}

export interface WikiHierarchyNode {
  id: string
  title: string
  level: number
  parent?: string
  children: string[]
  pageId?: string
  weight: number
}

export interface WikiCategory {
  id: string
  name: string
  description?: string
  pageIds: string[]
  parentId?: string
  children: string[]
}

export interface WikiRelationshipMap {
  dependencies: Map<string, string[]>
  references: Map<string, string[]>
  similarities: Map<string, string[]>
}

export interface AggregatedWikiMetadata {
  version: string
  strategy: string
  createdBy: string
  description?: string
  tags: string[]
  lastModified: Date
  statistics: AggregationStatistics
}

export enum AggregationType {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  SCHEDULED = 'scheduled',
  ON_DEMAND = 'on_demand'
}

export enum MergeStrategy {
  APPEND = 'append',
  INTERLEAVE = 'interleave',
  SEMANTIC = 'semantic',
  HIERARCHICAL = 'hierarchical',
  TEMPORAL = 'temporal'
}

export enum ConflictResolutionStrategy {
  MANUAL = 'manual',
  LATEST_WINS = 'latest_wins',
  QUALITY_SCORE = 'quality_score',
  MERGE = 'merge',
  SKIP = 'skip'
}

export enum AggregationAction {
  MERGE_PAGES = 'merge_pages',
  SKIP_DUPLICATE = 'skip_duplicate',
  CREATE_SECTION = 'create_section',
  ADD_REFERENCE = 'add_reference',
  UPDATE_METADATA = 'update_metadata'
}

export enum IssueType {
  DUPLICATE_CONTENT = 'duplicate_content',
  CONFLICTING_INFORMATION = 'conflicting_information',
  BROKEN_REFERENCES = 'broken_references',
  MISSING_METADATA = 'missing_metadata',
  STRUCTURE_CONFLICT = 'structure_conflict'
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum WarningType {
  SIMILAR_CONTENT = 'similar_content',
  OUTDATED_INFORMATION = 'outdated_information',
  POOR_QUALITY = 'poor_quality',
  MISSING_CONTEXT = 'missing_context'
}

export interface ConflictResolution {
  pageId: string
  conflictType: ConflictType
  resolution: ConflictResolutionStrategy
  resolvedAt: Date
  resolvedBy: string
  notes?: string
}

export enum ConflictType {
  TITLE_CONFLICT = 'title_conflict',
  CONTENT_CONFLICT = 'content_conflict',
  METADATA_CONFLICT = 'metadata_conflict',
  RELATIONSHIP_CONFLICT = 'relationship_conflict'
}

export interface DuplicateDetectionResult {
  duplicates: DuplicateGroup[]
  totalDuplicates: number
  processingTime: number
}

export interface DuplicateGroup {
  id: string
  pageIds: string[]
  similarity: number
  duplicateType: DuplicateType
  suggestedAction: SuggestedAction
}

export enum DuplicateType {
  EXACT = 'exact',
  NEAR_EXACT = 'near_exact',
  SIMILAR = 'similar',
  RELATED = 'related'
}

export enum SuggestedAction {
  MERGE = 'merge',
  KEEP_LATEST = 'keep_latest',
  KEEP_HIGHEST_QUALITY = 'keep_highest_quality',
  MANUAL_REVIEW = 'manual_review'
}