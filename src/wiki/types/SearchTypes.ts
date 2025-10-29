export interface SearchQuery {
  text: string
  filters: SearchFilter[]
  sortBy: SortOption
  limit?: number
  offset?: number
  facets?: string[]
  boost?: QueryBoost[]
  highlight?: HighlightConfig
  snippet?: SnippetConfig
}

export interface SearchFilter {
  field: SearchField
  operator: FilterOperator
  value: any
  boost?: number
}

export interface SortOption {
  field: SortField
  direction: SortDirection
  mode: SortMode
  missing?: MissingValueHandling
}

export interface QueryBoost {
  field: SearchField
  factor: number
  condition?: BoostCondition
}

export interface HighlightConfig {
  enabled: boolean
  fields: HighlightField[]
  preTag?: string
  postTag?: string
  fragmentSize?: number
  numberOfFragments?: number
}

export interface HighlightField {
  field: SearchField
  fragmentSize?: number
  numberOfFragments?: number
  order?: HighlightOrder
}

export interface SnippetConfig {
  enabled: boolean
  fields: SnippetField[]
  separator?: string
}

export interface SnippetField {
  field: SearchField
  size?: number
  offset?: number
}

export interface SearchResult {
  pages: SearchResultPage[]
  total: number
  maxScore: number
  took: number
  facets: Map<string, FacetResult>
  suggestions: SearchSuggestion[]
  aggregations: Map<string, AggregationResult>
  pagination: PaginationInfo
  query: SearchQuery
}

export interface SearchResultPage {
  page: SearchResultDocument
  score: number
  highlights: Map<string, string[]>
  snippets: Map<string, string>
  explanation?: ResultExplanation
}

export interface SearchResultDocument {
  id: string
  title: string
  content: string
  excerpt: string
  url: string
  metadata: DocumentMetadata
  fields: Map<string, any>
  _score?: number
}

export interface DocumentMetadata {
  projectId: string
  author?: string
  createdAt: Date
  updatedAt: Date
  language: string
  category: string
  tags: string[]
  size: number
  wordCount: number
  readingTime: number
  difficulty: DifficultyLevel
}

export interface ResultExplanation {
  value: number
  description: string
  details: ExplanationDetail[]
}

export interface ExplanationDetail {
  type: ExplanationType
  value: number
  description: string
  factors: FactorBreakdown[]
}

export interface FactorBreakdown {
  factor: string
  weight: number
  contribution: number
  normalizedValue: number
}

export interface FacetResult {
  field: string
  type: FacetType
  buckets: FacetBucket[]
  total: number
  missing: number
  other: number
}

export interface FacetBucket {
  key: string
  docCount: number
  selected: boolean
  subBuckets?: FacetBucket[]
  data?: Map<string, any>
}

export interface SearchSuggestion {
  text: string
  type: SuggestionType
  score: number
  source: string
  highlight?: string
  payload?: any
}

export interface AggregationResult {
  name: string
  type: AggregationType
  buckets: AggregationBucket[]
  value?: any
  meta?: AggregationMeta
}

export interface AggregationBucket {
  key: string
  docCount: number
  subAggregations?: Map<string, AggregationResult>
  data?: Map<string, any>
}

export interface AggregationMeta {
  count: number
  sum?: number
  min?: number
  max?: number
  avg?: number
}

export interface PaginationInfo {
  current: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
  nextOffset?: number
  previousOffset?: number
}

export interface SearchIndex {
  documents: Map<string, SearchDocument>
  terms: Map<string, TermInfo>
  fields: Map<string, FieldInfo>
  metadata: SearchIndexMetadata
  analyzers: Map<string, Analyzer>
  settings: SearchSettings
}

export interface SearchDocument {
  id: string
  fields: Map<string, any>
  vectors?: Map<string, number[]>
  metadata: DocumentMetadata
  _boost?: number
  _score?: number
  title?: string
}

export interface TermInfo {
  term: string
  field: string
  frequency: number
  docFrequency: number
  totalTermFreq: number
  postings: Posting[]
  positionGap: number
  offset: number
  payload?: any
}

export interface Posting {
  docId: string
  positions: number[]
  offsets: Offset[]
  payloads?: any[]
  termFrequency: number
  norms?: number
}

export interface Offset {
  start: number
  end: number
}

export interface FieldInfo {
  name: string
  type: FieldType
  indexed: boolean
  stored: boolean
  tokenized: boolean
  analyzer: string
  norms: boolean
  termVectors: boolean
  docValues: boolean
  similarity: SimilarityType
  boost: number
}

export interface SearchIndexMetadata {
  version: string
  createdAt: Date
  updatedAt: Date
  documentCount: number
  termCount: number
  size: number
  health: IndexHealth
  statistics: IndexStatistics
}

export interface IndexStatistics {
  averageDocumentLength: number
  averageFieldLength: Map<string, number>
  fieldCardinality: Map<string, number>
  termHistogram: Map<string, number>
  documentHistogram: Map<string, number>
  queryStats: QueryStatistics
}

export interface QueryStatistics {
  totalQueries: number
  averageQueryTime: number
  slowQueries: number
  popularQueries: Map<string, number>
  emptyResults: number
  errorRate: number
}

export interface Analyzer {
  name: string
  tokenizer: Tokenizer
  filters: TokenFilter[]
  charFilters: CharFilter[]
}

export interface Tokenizer {
  type: TokenizerType
  config: Map<string, any>
}

export interface TokenFilter {
  type: FilterType
  config: Map<string, any>
}

export interface CharFilter {
  type: CharFilterType
  config: Map<string, any>
}

export interface SearchSettings {
  indexing: IndexingSettings
  search: SearchSettingsConfig
  analysis: AnalysisSettings
  performance: PerformanceSettings
}

export interface IndexingSettings {
  bufferSize: number
  refreshInterval: string
  maxResultWindow: number
  numberOfShards: number
  numberOfReplicas: number
  codec: CodecType
}

export interface SearchSettingsConfig {
  defaultOperator: QueryOperator
  minimumShouldMatch: string
  analyzeWildcard: boolean
  autoGeneratePhraseQueries: boolean
  phraseSlop: number
  boostFactor: number
}

export interface AnalysisSettings {
  analyzer: Map<string, Analyzer>
  tokenizer: Map<string, Tokenizer>
  filter: Map<string, TokenFilter>
  charFilter: Map<string, CharFilter>
}

export interface PerformanceSettings {
  cacheSize: number
  timeout: number
  maxConcurrentSearches: number
  slowSearchThreshold: number
  enableCache: boolean
  enableQueryCache: boolean
}

export interface IndexHealth {
  status: HealthStatus
  activeShards: number
  relocatingShards: number
  initializingShards: number
  unassignedShards: number
  validationFailures: ValidationFailure[]
}

export interface ValidationFailure {
  shard: string
  index: string
  reason: string
  severity: FailureSeverity
  timestamp: Date
}

export interface SearchConfig {
  defaultLimit: number
  maxLimit: number
  defaultSort: SortOption[]
  enableHighlight: boolean
  enableSnippets: boolean
  enableFacets: boolean
  enableSuggestions: boolean
  cacheEnabled: boolean
  cacheTTL: number
  indexRefreshInterval: number
  queryTimeout: number
}

export enum SearchField {
  TITLE = 'title',
  CONTENT = 'content',
  CATEGORY = 'category',
  TAGS = 'tags',
  AUTHOR = 'author',
  LANGUAGE = 'language',
  PROJECT_ID = 'projectId',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  SIZE = 'size',
  WORD_COUNT = 'wordCount',
  READING_TIME = 'readingTime',
  DIFFICULTY = 'difficulty'
}

export enum SortField {
  SCORE = '_score',
  TITLE = 'title',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  SIZE = 'size',
  RELEVANCE = 'relevance',
  POPULARITY = 'popularity'
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  IN = 'in',
  NOT_IN = 'not_in',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
  REGEX = 'regex',
  WILDCARD = 'wildcard',
  FUZZY = 'fuzzy'
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

export enum SortMode {
  MIN = 'min',
  MAX = 'max',
  SUM = 'sum',
  AVG = 'avg'
}

export enum MissingValueHandling {
  LAST = 'last',
  FIRST = 'first',
  IGNORE = 'ignore'
}

export enum BoostCondition {
  ALWAYS = 'always',
  CONTAINS = 'contains',
  MATCHES = 'matches',
  RANGE = 'range'
}

export enum HighlightOrder {
  SCORE = 'score',
  OFFSET = 'offset'
}

export enum SuggestionType {
  TERM = 'term',
  PHRASE = 'phrase',
  COMPLETION = 'completion',
  CORRECTION = 'correction',
  CONTEXTUAL = 'contextual'
}

export enum ExplanationType {
  TERM_MATCH = 'term_match',
  PHRASE_MATCH = 'phrase_match',
  PROXIMITY = 'proximity',
  FIELD_NORM = 'field_norm',
  INVERSE_DOC_FREQ = 'inverse_doc_freq',
  TERM_FREQ = 'term_freq',
  COORDINATION = 'coordination',
  QUERY_NORM = 'query_norm',
  BOOST = 'boost'
}

export enum FacetType {
  TERMS = 'terms',
  RANGE = 'range',
  DATE_RANGE = 'date_range',
  HISTOGRAM = 'histogram',
  STATISTICAL = 'statistical'
}

export enum AggregationType {
  TERMS = 'terms',
  DATE_HISTOGRAM = 'date_histogram',
  HISTOGRAM = 'histogram',
  RANGE = 'range',
  STATS = 'stats',
  EXTENDED_STATS = 'extended_stats',
  CARDINALITY = 'cardinality',
  FILTER = 'filter',
  NESTED = 'nested'
}

export enum FieldType {
  TEXT = 'text',
  KEYWORD = 'keyword',
  INTEGER = 'integer',
  LONG = 'long',
  FLOAT = 'float',
  DOUBLE = 'double',
  BOOLEAN = 'boolean',
  DATE = 'date',
  BINARY = 'binary',
  GEO_POINT = 'geo_point',
  OBJECT = 'object',
  ARRAY = 'array'
}

export enum SimilarityType {
  BM25 = 'bm25',
  CLASSIC = 'classic',
  BOOLEAN = 'boolean',
  DF_RANK = 'df_rank'
}

export enum TokenizerType {
  STANDARD = 'standard',
  KEYWORD = 'keyword',
  WHITESPACE = 'whitespace',
  NGRAM = 'ngram',
  EDGE_NGRAM = 'edge_ngram',
  PATH = 'path',
  PATTERN = 'pattern'
}

export enum FilterType {
  LOWERCASE = 'lowercase',
  UPPERCASE = 'uppercase',
  STOP = 'stop',
  STEMMER = 'stemmer',
  SYNONYM = 'synonym',
  ASCIIFOLDING = 'asciifolding',
  LENGTH = 'length',
  PATTERN_REPLACE = 'pattern_replace',
  TRIM = 'trim'
}

export enum CharFilterType {
  HTML_STRIP = 'html_strip',
  PATTERN_REPLACE = 'pattern_replace',
  MAPPING = 'mapping'
}

export enum QueryOperator {
  AND = 'and',
  OR = 'or'
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum HealthStatus {
  GREEN = 'green',
  YELLOW = 'yellow',
  RED = 'red'
}

export enum FailureSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum CodecType {
  DEFAULT = 'default',
  BEST_COMPRESSION = 'best_compression',
  BEST_SPEED = 'best_speed',
  DEFLATE = 'deflate',
  LZ4 = 'lz4'
}