export interface WikiLink {
  id: string
  source: string
  target: string
  type: LinkType
  strength: number
  metadata?: LinkMetadata
  createdAt: Date
  updatedAt: Date
  bidirectional: boolean
}

export interface LinkMetadata {
  context?: string
  anchor?: string
  title?: string
  description?: string
  tags?: string[]
  weight?: number
  confidence?: number
  sourceType?: LinkSourceType
  verified?: boolean
}

export interface LinkAnalysis {
  links: WikiLink[]
  clusters: LinkCluster[]
  orphans: OrphanPage[]
  hubs: HubPage[]
  statistics: LinkStatistics
  recommendations: LinkRecommendation[]
}

export interface LinkCluster {
  id: string
  name: string
  pageIds: string[]
  centrality: number
  density: number
  topic?: string
  strength: number
}

export interface OrphanPage {
  pageId: string
  title: string
  reason: OrphanReason
  suggestions: string[]
}

export interface HubPage {
  pageId: string
  title: string
  linkCount: number
  centralityScore: number
  importance: PageImportance
}

export interface LinkStatistics {
  totalLinks: number
  averageLinksPerPage: number
  linkDistribution: Map<LinkType, number>
  strongestLinks: WikiLink[]
  weakestLinks: WikiLink[]
  mostConnectedPages: string[]
  leastConnectedPages: string[]
  linkDensity: number
  clusteringCoefficient: number
}

export interface LinkRecommendation {
  type: RecommendationType
  source: string
  target: string
  reason: string
  confidence: number
  priority: RecommendationPriority
  suggestedLinkType: LinkType
}

export interface CrossReference {
  id: string
  sourcePageId: string
  referenceType: ReferenceType
  targetContent: string
  context: string
  strength: number
  metadata: CrossReferenceMetadata
}

export interface CrossReferenceMetadata {
  createdAt: Date
  verified: boolean
  tags: string[]
  category?: string
  relatedTopics: string[]
}

export interface LinkSuggestion {
  source: string
  target: string
  type: LinkType
  strength: number
  reason: SuggestionReason
  confidence: number
  context?: string
}

export interface RelationshipStrength {
  pageId: string
  relationships: Map<string, number>
  totalStrength: number
  strongestRelationship: string
  relationshipTypes: Map<LinkType, number>
}

export interface LinkGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  metadata: GraphMetadata
}

export interface GraphNode {
  id: string
  title: string
  x?: number
  y?: number
  size: number
  color: string
  group: string
  metadata: NodeMetadata
}

export interface GraphEdge {
  source: string
  target: string
  weight: number
  type: LinkType
  color: string
  metadata: EdgeMetadata
}

export interface NodeMetadata {
  linkCount: number
  centrality: number
  importance: PageImportance
  categories: string[]
  tags: string[]
}

export interface EdgeMetadata {
  createdAt: Date
  strength: number
  bidirectional: boolean
  verified: boolean
}

export interface GraphMetadata {
  totalNodes: number
  totalEdges: number
  averageDegree: number
  density: number
  clusteringCoefficient: number
  lastUpdated: Date
}

export enum LinkType {
  REFERENCES = 'references',
  DEPENDS_ON = 'depends_on',
  SIMILAR_TO = 'similar_to',
  EXTENDS = 'extends',
  IMPLEMENTS = 'implements',
  RELATED_TO = 'related_to',
  MENTIONS = 'mentions',
  CITES = 'cites',
  EXPLAINS = 'explains',
  EXAMPLE_OF = 'example_of'
}

export enum LinkSourceType {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  SEMANTIC = 'semantic',
  STRUCTURAL = 'structural',
  CONTENT_BASED = 'content_based',
  USER_SUGGESTED = 'user_suggested'
}

export enum OrphanReason {
  NO_INCOMING_LINKS = 'no_incoming_links',
  NO_OUTGOING_LINKS = 'no_outgoing_links',
  BROKEN_LINKS = 'broken_links',
  ISOLATED_TOPIC = 'isolated_topic',
  NEW_PAGE = 'new_page'
}

export enum PageImportance {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecommendationType {
  ADD_LINK = 'add_link',
  REMOVE_LINK = 'remove_link',
  STRENGTHEN_LINK = 'strengthen_link',
  CREATE_BIDIRECTIONAL = 'create_bidirectional',
  CATEGORIZE = 'categorize',
  VERIFY_LINK = 'verify_link'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ReferenceType {
  DEFINITION = 'definition',
  EXAMPLE = 'example',
  EXPLANATION = 'explanation',
  IMPLEMENTATION = 'implementation',
  USAGE = 'usage',
  DEPENDENCY = 'dependency',
  ALTERNATIVE = 'alternative',
  COMPARISON = 'comparison',
  MENTION = 'mention'
}

export enum SuggestionReason {
  CONTENT_SIMILARITY = 'content_similarity',
  SHARED_KEYWORDS = 'shared_keywords',
  SEMANTIC_RELATIONSHIP = 'semantic_relationship',
  STRUCTURAL_PROXIMITY = 'structural_proximity',
  USER_BEHAVIOR = 'user_behavior',
  EXPLICIT_MENTION = 'explicit_mention',
  CODE_REFERENCE = 'code_reference',
  CATEGORY_MATCH = 'category_match'
}

export interface LinkValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  suggestions: ValidationSuggestion[]
}

export interface ValidationIssue {
  type: ValidationIssueType
  severity: ValidationSeverity
  message: string
  linkId?: string
  pageId?: string
}

export interface ValidationSuggestion {
  action: SuggestionAction
  description: string
  linkId?: string
  pageId?: string
  estimatedImpact: string
}

export enum ValidationIssueType {
  BROKEN_LINK = 'broken_link',
  REDUNDANT_LINK = 'redundant_link',
  WEAK_LINK = 'weak_link',
  MISSING_BIDIRECTIONAL = 'missing_bidirectional',
  INAPPROPRIATE_TYPE = 'inappropriate_type',
  OUTDATED_REFERENCE = 'outdated_reference'
}

export enum ValidationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SuggestionAction {
  ADD_LINK = 'add_link',
  REMOVE_LINK = 'remove_link',
  UPDATE_LINK_TYPE = 'update_link_type',
  CREATE_BIDIRECTIONAL = 'create_bidirectional',
  VERIFY_TARGET = 'verify_target',
  UPDATE_STRENGTH = 'update_strength'
}

export interface LinkMetrics {
  totalLinks: number
  linksByType: Map<LinkType, number>
  averageStrength: number
  linkDensity: number
  connectivityScore: number
  centralityDistribution: Map<string, number>
  clusteringCoefficient: number
  pathLength: number
  diameter: number
}

export interface LinkingConfig {
  autoLinking: boolean
  minLinkStrength: number
  maxLinksPerPage: number
  enabledLinkTypes: LinkType[]
  suggestionThreshold: number
  validationEnabled: boolean
  bidirectionalPreference: boolean
  cacheEnabled: boolean
  cacheTTL: number
}