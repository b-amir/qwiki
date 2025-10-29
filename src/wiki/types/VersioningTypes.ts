export interface WikiVersion {
  id: string
  pageId: string
  version: string
  content: string
  title: string
  author: string
  timestamp: Date
  changelog: string
  tags: string[]
  metadata: VersionMetadata
  differences: VersionDiff
  parentVersion?: string
  childVersions: string[]
  branch: string
  isDeleted: boolean
}

export interface VersionMetadata {
  wordCount: number
  characterCount: number
  readingTime: number
  complexity: ComplexityMetrics
  sections: SectionInfo[]
  links: LinkInfo[]
  images: ImageInfo[]
  codeBlocks: CodeBlockInfo[]
  checksum: string
  contentType: ContentType
  language: string
  lastModified: Date
}

export interface ComplexityMetrics {
  readabilityScore: number
  technicalComplexity: number
  structuralComplexity: number
  overallComplexity: number
  factors: ComplexityFactor[]
}

export interface ComplexityFactor {
  type: FactorType
  score: number
  description: string
  impact: string
}

export interface SectionInfo {
  id: string
  title: string
  level: number
  wordCount: number
  position: number
  subsections: string[]
}

export interface LinkInfo {
  url: string
  text: string
  type: LinkType
  isValid: boolean
  targetPage?: string
}

export interface ImageInfo {
  src: string
  alt: string
  title?: string
  size: number
  dimensions?: ImageDimensions
}

export interface ImageDimensions {
  width: number
  height: number
}

export interface CodeBlockInfo {
  language: string
  lineCount: number
  complexity: number
  dependencies: string[]
  functions: string[]
}

export interface VersionDiff {
  summary: DiffSummary
  sections: DiffSection[]
  statistics: DiffStatistics
  hunks: DiffHunk[]
}

export interface DiffSummary {
  additions: number
  deletions: number
  modifications: number
  totalChanges: number
  similarity: number
  type: DiffType
}

export interface DiffSection {
  id: string
  title: string
  type: SectionDiffType
  changes: DiffChange[]
  significance: ChangeSignificance
}

export interface DiffChange {
  type: ChangeType
  content: string
  position: number
  oldContent?: string
  newContent?: string
  context: string[]
  significance: number
}

export interface DiffStatistics {
  linesAdded: number
  linesRemoved: number
  linesModified: number
  sectionsAdded: number
  sectionsRemoved: number
  sectionsModified: number
  wordsAdded: number
  wordsRemoved: number
  charactersAdded: number
  charactersRemoved: number
  totalChanges: number
}

export interface DiffHunk {
  id: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  changes: DiffChange[]
  context: string[]
}

export interface VersionHistory {
  pageId: string
  versions: WikiVersion[]
  timeline: TimelineEntry[]
  statistics: HistoryStatistics
  branches: BranchInfo[]
  tags: VersionTag[]
}

export interface TimelineEntry {
  version: string
  timestamp: Date
  author: string
  type: TimelineEntryType
  description: string
  changes: number
  significance: ChangeSignificance
}

export interface HistoryStatistics {
  totalVersions: number
  totalAuthors: number
  averageChangesPerVersion: number
  mostActiveAuthor: string
  averageTimeBetweenVersions: number
  growthRate: number
  activityByAuthor: Map<string, AuthorActivity>
  activityByMonth: Map<string, MonthlyActivity>
}

export interface AuthorActivity {
  versions: number
  additions: number
  deletions: number
  lastContribution: Date
  role: AuthorRole
}

export interface MonthlyActivity {
  versions: number
  authors: number
  changes: number
  growthRate: number
}

export interface BranchInfo {
  name: string
  headVersion: string
  baseVersion: string
  createdAt: Date
  createdBy: string
  isMain: boolean
  isProtected: boolean
  description: string
}

export interface VersionTag {
  name: string
  version: string
  createdAt: Date
  createdBy: string
  description: string
  isStable: boolean
}

export interface VersionComparison {
  fromVersion: string
  toVersion: string
  summary: ComparisonSummary
  differences: DetailedDiff[]
  statistics: ComparisonStatistics
  insights: ComparisonInsight[]
}

export interface ComparisonSummary {
  similarity: number
  differences: number
  significance: ComparisonSignificance
  recommendation: string
  riskLevel: RiskLevel
}

export interface DetailedDiff {
  section: string
  type: DiffType
  changes: DiffChange[]
  impact: string
  suggestions: string[]
}

export interface ComparisonStatistics {
  unchangedLines: number
  changedLines: number
  addedLines: number
  removedLines: number
  structuralChanges: number
  contentChanges: number
  formattingChanges: number
  totalChanges: number
}

export interface ComparisonInsight {
  type: InsightType
  message: string
  severity: InsightSeverity
  recommendation: string
  affectedSections: string[]
}

export interface VersionConflict {
  id: string
  pageId: string
  baseVersion: string
  conflictingVersions: string[]
  conflicts: Conflict[]
  resolution?: ConflictResolution
  status: ConflictStatus
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: string
}

export interface Conflict {
  id: string
  type: ConflictType
  section: string
  position: number
  content: ConflictContent
  suggestions: ConflictSuggestion[]
  severity: ConflictSeverity
  autoResolvable: boolean
}

export interface ConflictContent {
  base: string
  version1: string
  version2: string
  merged?: string
}

export interface ConflictSuggestion {
  type: SuggestionType
  content: string
  confidence: number
  reasoning: string
}

export interface ConflictResolution {
  strategy: ResolutionStrategy
  resolvedContent: string
  reviewer: string
  notes: string
  timestamp: Date
}

export interface VersioningConfig {
  maxVersionsPerPage: number
  autoSaveInterval: number
  compressionEnabled: boolean
  retentionPeriod: number
  enableBranching: boolean
  enableTagging: boolean
  enableConflictDetection: boolean
  diffAlgorithm: DiffAlgorithm
  similarityThreshold: number
  autoMergeEnabled: boolean
}

export enum ContentType {
  MARKDOWN = 'markdown',
  HTML = 'html',
  TEXT = 'text',
  CODE = 'code',
  MIXED = 'mixed'
}

export enum FactorType {
  READABILITY = 'readability',
  TECHNICAL = 'technical',
  STRUCTURAL = 'structural',
  LENGTH = 'length',
  COMPLEXITY = 'complexity',
  VOCABULARY = 'vocabulary',
  SENTENCE_STRUCTURE = 'sentence_structure'
}

export enum LinkType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  IMAGE = 'image',
  EMAIL = 'email',
  PHONE = 'phone',
  ANCHOR = 'anchor'
}

export enum DiffType {
  ADDITION = 'addition',
  DELETION = 'deletion',
  MODIFICATION = 'modification',
  MOVE = 'move',
  COPY = 'copy',
  RENAME = 'rename',
  FORMAT = 'format',
  STRUCTURE = 'structure'
}

export enum SectionDiffType {
  CONTENT = 'content',
  STRUCTURE = 'structure',
  METADATA = 'metadata',
  FORMATTING = 'formatting',
  LINKS = 'links',
  IMAGES = 'images',
  CODE = 'code'
}

export enum ChangeType {
  INSERT = 'insert',
  DELETE = 'delete',
  REPLACE = 'replace',
  MOVE = 'move',
  FORMAT = 'format',
  SPLIT = 'split',
  MERGE = 'merge'
}

export enum ChangeSignificance {
  TRIVIAL = 'trivial',
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export enum TimelineEntryType {
  CREATED = 'created',
  UPDATED = 'updated',
  BRANCHED = 'branched',
  MERGED = 'merged',
  TAGGED = 'tagged',
  REVERTED = 'reverted',
  DELETED = 'deleted',
  RESTORED = 'restored'
}

export enum AuthorRole {
  AUTHOR = 'author',
  EDITOR = 'editor',
  REVIEWER = 'reviewer',
  MAINTAINER = 'maintainer',
  CONTRIBUTOR = 'contributor'
}

export enum ComparisonSignificance {
  IDENTICAL = 'identical',
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  COMPLETELY_DIFFERENT = 'completely_different'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum InsightType {
  PERFORMANCE = 'performance',
  COMPATIBILITY = 'compatibility',
  MAINTAINABILITY = 'maintainability',
  SECURITY = 'security',
  CONTENT_QUALITY = 'content_quality',
  STRUCTURAL_INTEGRITY = 'structural_integrity',
  COMPLEXITY = 'complexity'
}

export enum InsightSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum ConflictType {
  CONTENT = 'content',
  STRUCTURE = 'structure',
  METADATA = 'metadata',
  FORMATTING = 'formatting',
  VERSION = 'version',
  BRANCH = 'branch'
}

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SuggestionType {
  AUTO_MERGE = 'auto_merge',
  MANUAL_REVIEW = 'manual_review',
  KEEP_BASE = 'keep_base',
  KEEP_VERSION1 = 'keep_version1',
  KEEP_VERSION2 = 'keep_version2',
  COMBINE = 'combine'
}

export enum ConflictStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
  FAILED = 'failed'
}

export enum ResolutionStrategy {
  MANUAL = 'manual',
  AUTO_MERGE = 'auto_merge',
  KEEP_BASE = 'keep_base',
  KEEP_LATEST = 'keep_latest',
  CUSTOM = 'custom'
}

export enum DiffAlgorithm {
  MYERS = 'myers',
  HISTOGRAM = 'histogram',
  PATIENCE = 'patience',
  MINIMAL = 'minimal'
}