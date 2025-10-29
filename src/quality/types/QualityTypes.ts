export interface QualityMetrics {
  clarity: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  overall: number;
}

export interface MetricThresholds {
  minimum: number;
  target: number;
  maximum: number;
}

export interface QualityReport {
  metrics: QualityMetrics;
  issues: QualityIssue[];
  recommendations: QualityRecommendation[];
  score: number;
}

export interface QualityIssue {
  type: IssueType;
  description: string;
  severity: IssueSeverity;
  location?: string;
  suggestion?: string;
}

export interface QualityRecommendation {
  type: RecommendationType;
  description: string;
  priority: Priority;
  impact: Impact;
  effort: Effort;
}

export interface DocumentationContext {
  codeType: string;
  language: string;
  complexity: Complexity;
  audience: Audience;
  purpose: DocumentationPurpose;
}

export interface QualityTrend {
  timeframe: TimePeriod;
  metrics: QualityMetrics[];
  trend: TrendDirection;
  improvement: number;
}

export interface TimePeriod {
  startDate: Date;
  endDate: Date;
}

export enum IssueType {
  CLARITY = 'clarity',
  COMPLETENESS = 'completeness',
  ACCURACY = 'accuracy',
  CONSISTENCY = 'consistency',
  STYLE = 'style',
  GRAMMAR = 'grammar'
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RecommendationType {
  REPHRASE = 'rephrase',
  ADD_CONTENT = 'add_content',
  REMOVE_CONTENT = 'remove_content',
  RESTRUCTURE = 'restructure',
  VERIFY_FACTS = 'verify_facts',
  IMPROVE_STYLE = 'improve_style'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum Impact {
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  CRITICAL = 'critical'
}

export enum Effort {
  MINIMAL = 'minimal',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  EXTENSIVE = 'extensive'
}

export enum Complexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  ADVANCED = 'advanced'
}

export enum Audience {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  MIXED = 'mixed'
}

export enum DocumentationPurpose {
  REFERENCE = 'reference',
  TUTORIAL = 'tutorial',
  EXPLANATION = 'explanation',
  OVERVIEW = 'overview',
  API_DOCUMENTATION = 'api_documentation',
  CODE_EXAMPLES = 'code_examples'
}

export enum TrendDirection {
  IMPROVING = 'improving',
  DECLINING = 'declining',
  STABLE = 'stable',
  FLUCTUATING = 'fluctuating'
}

export interface ImprovementSuggestion {
  type: RecommendationType;
  description: string;
  priority: Priority;
  impact: Impact;
  effort: Effort;
  affectedContent?: string;
  automatedAction?: boolean;
}

export interface ImprovementPlan {
  suggestions: ImprovementSuggestion[];
  estimatedTime: number;
  impact: Impact;
  priority: Priority;
  totalEffort: Effort;
  automatedActions: number;
}

export interface ProgressReport {
  totalSuggestions: number;
  completedSuggestions: number;
  pendingSuggestions: number;
  automatedSuggestions: number;
  averageImpact: number;
  completionRate: number;
}