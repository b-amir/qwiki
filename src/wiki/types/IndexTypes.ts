export interface WikiIndex {
  pages: Map<string, IndexEntry>
  categories: Map<string, string[]>
  tags: Map<string, string[]>
  structure: IndexStructure
  metadata: IndexMetadata
  searchIndex: EnhancedSearchIndex
}

export interface IndexEntry {
  pageId: string
  title: string
  category: string
  tags: string[]
  keywords: string[]
  excerpt: string
  relevanceScore?: number
  lastModified: Date
  size: number
  language: string
  relationships: PageRelationships
}

export interface IndexStructure {
  hierarchy: HierarchyNode[]
  navigation: NavigationMap
  tableOfContents: TableOfContentsEntry[]
  crossReferences: CrossReferenceMap
}

export interface HierarchyNode {
  id: string
  title: string
  level: number
  parent?: string
  children: string[]
  pageId?: string
  weight: number
  order: number
}

export interface NavigationMap {
  breadcrumb: BreadcrumbEntry[]
  sidebar: SidebarSection[]
  quickLinks: QuickLink[]
  recentPages: RecentPageEntry[]
}

export interface BreadcrumbEntry {
  id: string
  title: string
  url: string
  level: number
}

export interface SidebarSection {
  id: string
  title: string
  entries: SidebarEntry[]
  expanded: boolean
  order: number
}

export interface SidebarEntry {
  id: string
  title: string
  url: string
  icon?: string
  badge?: string
  children?: SidebarEntry[]
}

export interface QuickLink {
  id: string
  title: string
  url: string
  description?: string
  icon?: string
  priority: number
}

export interface RecentPageEntry {
  pageId: string
  title: string
  lastAccessed: Date
  accessCount: number
}

export interface TableOfContentsEntry {
  id: string
  title: string
  level: number
  anchor: string
  children: TableOfContentsEntry[]
  pageId: string
}

export interface CrossReferenceMap {
  definitions: Map<string, string[]>
  references: Map<string, string[]>
  dependencies: Map<string, string[]>
  similarPages: Map<string, string[]>
}

export interface IndexMetadata {
  projectId: string
  totalPages: number
  totalCategories: number
  totalTags: number
  lastUpdated: Date
  version: string
  buildTime: number
  size: number
  languages: string[]
  statistics: IndexStatistics
}

export interface IndexStatistics {
  averagePageLength: number
  pagesPerCategory: Map<string, number>
  tagDistribution: Map<string, number>
  languageDistribution: Map<string, number>
  updateFrequency: Map<string, number>
  accessPatterns: AccessPattern[]
}

export interface AccessPattern {
  pageId: string
  accessCount: number
  lastAccessed: Date
  averageSessionDuration: number
  bounceRate: number
}

export interface EnhancedSearchIndex {
  documents: Map<string, SearchDocument>
  terms: Map<string, TermInfo>
  metadata: SearchMetadata
  filters: SearchFilters
  suggestions: SearchSuggestions
}

export interface SearchDocument {
  id: string
  pageId: string
  title: string
  content: string
  keywords: string[]
  tokens: string[]
  vectors?: number[]
  metadata: DocumentMetadata
}

export interface TermInfo {
  term: string
  frequency: number
  documents: string[]
  positions: Map<string, number[]>
  weight: number
  lastSeen: Date
}

export interface SearchMetadata {
  totalDocuments: number
  totalTerms: number
  vocabularySize: number
  averageDocumentLength: number
  indexSize: number
  lastUpdated: Date
  version: number
}

export interface SearchFilters {
  categories: Set<string>
  tags: Set<string>
  languages: Set<string>
  dateRange: DateRange
  sizeRange: SizeRange
}

export interface SearchSuggestions {
  popularTerms: string[]
  recentQueries: string[]
  autoCorrect: Map<string, string>
  synonyms: Map<string, string[]>
}

export interface DocumentMetadata {
  created: Date
  modified: Date
  author?: string
  language: string
  category: string
  tags: string[]
  size: number
  wordCount: number
}

export interface PageRelationships {
  dependencies: string[]
  dependents: string[]
  references: string[]
  referencedBy: string[]
  similar: string[]
  related: string[]
}

export interface IndexStatistics {
  coverage: number
  completeness: number
  accuracy: number
  freshness: number
  accessibility: number
}

export interface IndexEntry {
  pageId: string
  title: string
  category: string
  tags: string[]
  keywords: string[]
  excerpt: string
  relevanceScore?: number
}

export interface IndexStatistics {
  totalPages: number
  totalCategories: number
  totalTags: number
  coverage: number
  completeness: number
  accuracy: number
  freshness: number
  accessibility: number
}

export interface SearchQuery {
  text: string
  filters: QueryFilter[]
  sortBy: SortOption
  limit?: number
  offset?: number
  facets?: string[]
}

export interface QueryFilter {
  field: string
  operator: FilterOperator
  value: any
}

export interface SearchResult {
  pages: SearchResultPage[]
  total: number
  facets: Map<string, FacetResult>
  suggestions: string[]
  queryTime: number
  didYouMean?: string
}

export interface SearchResultPage {
  page: IndexEntry
  score: number
  highlights: string[]
  snippets: string[]
}

export interface FacetResult {
  field: string
  values: FacetValue[]
}

export interface FacetValue {
  value: string
  count: number
  selected: boolean
}

export interface SortOption {
  field: string
  direction: SortDirection
  weight?: number
}

export interface IndexHealth {
  score: number
  issues: HealthIssue[]
  recommendations: HealthRecommendation[]
  lastCheck: Date
}

export interface HealthIssue {
  type: IssueType
  severity: Severity
  message: string
  affectedPages: string[]
  suggestedFix: string
}

export interface HealthRecommendation {
  type: RecommendationType
  priority: Priority
  description: string
  estimatedImpact: string
  action: string
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  NOT_IN = 'not_in'
}

export enum IssueType {
  BROKEN_LINKS = 'broken_links',
  MISSING_METADATA = 'missing_metadata',
  OUTDATED_CONTENT = 'outdated_content',
  POOR_COVERAGE = 'poor_coverage',
  PERFORMANCE_ISSUES = 'performance_issues',
  INCONSISTENT_FORMATTING = 'inconsistent_formatting'
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecommendationType {
  UPDATE_METADATA = 'update_metadata',
  REFRESH_CONTENT = 'refresh_content',
  IMPROVE_COVERAGE = 'improve_coverage',
  OPTIMIZE_PERFORMANCE = 'optimize_performance',
  STANDARDIZE_FORMAT = 'standardize_format'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface DateRange {
  start?: Date
  end?: Date
}

export interface SizeRange {
  min?: number
  max?: number
}

export interface IndexConfig {
  autoUpdate: boolean
  updateInterval: number
  maxPages: number
  indexingDepth: number
  includeContent: boolean
  enableFacetedSearch: boolean
  enableSuggestions: boolean
  cacheEnabled: boolean
  cacheTTL: number
  compressionEnabled: boolean
}