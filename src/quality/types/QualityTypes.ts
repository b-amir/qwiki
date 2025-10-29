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

export interface QAWorkflow {
  id: string;
  name: string;
  steps: QAStep[];
  checks: QACheck[];
  approvals: QAApproval[];
  standards: QualityStandard[];
  enabled: boolean;
}

export interface QAStep {
  id: string;
  name: string;
  description: string;
  type: StepType;
  required: boolean;
  order: number;
  automated: boolean;
}

export interface QACheck {
  id: string;
  name: string;
  description: string;
  type: CheckType;
  severity: IssueSeverity;
  enabled: boolean;
}

export interface QAApproval {
  id: string;
  approver: string;
  role: string;
  required: boolean;
  status: ApprovalStatus;
  timestamp?: Date;
  comments?: string;
}

export interface QualityStandard {
  id: string;
  name: string;
  description: string;
  category: StandardCategory;
  rules: ValidationRule[];
  threshold: MetricThresholds;
  enabled: boolean;
}

export interface ValidationRule {
  id: string;
  name: string;
  pattern: string;
  description: string;
  severity: IssueSeverity;
  enabled: boolean;
}

export interface QACheckResult {
  passed: boolean;
  issues: QualityIssue[];
  recommendations: ImprovementSuggestion[];
  score: number;
  completedAt: Date;
  completedBy: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number;
}

export interface ValidationError {
  rule: string;
  message: string;
  location?: string;
  severity: IssueSeverity;
}

export interface ValidationWarning {
  rule: string;
  message: string;
  location?: string;
  suggestion?: string;
}

export enum StepType {
  VALIDATION = 'validation',
  REVIEW = 'review',
  APPROVAL = 'approval',
  AUTOMATED_CHECK = 'automated_check'
}

export enum CheckType {
  ACCURACY = 'accuracy',
  COMPLETENESS = 'completeness',
  CLARITY = 'clarity',
  CONSISTENCY = 'consistency',
  STYLE = 'style',
  GRAMMAR = 'grammar'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SKIPPED = 'skipped'
}

export enum StandardCategory {
  CONTENT = 'content',
  STYLE = 'style',
  TECHNICAL = 'technical',
  LEGAL = 'legal',
  ACCESSIBILITY = 'accessibility'
}