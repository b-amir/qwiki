import type { ProjectContext } from "@/domain/entities/Selection";

export interface PromptTemplate {
  id: string;
  name: string;
  sections: PromptSection[];
  variables: PromptVariable[];
  metadata: {
    version: string;
    author?: string;
    description?: string;
    language?: string;
    complexity?: "simple" | "moderate" | "complex";
  };
}

export interface PromptSection {
  name: string;
  content: string;
  conditional?: (context: ProjectContext) => boolean;
  priority: number;
}

export interface PromptVariable {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  defaultValue?: any;
}

export interface DynamicPromptConfig {
  context: ProjectContext;
  provider: string;
  language?: string;
  complexity?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EffectivenessScore {
  score: number;
  metrics: {
    clarity: number;
    completeness: number;
    specificity: number;
    consistency: number;
  };
}

export interface TestCase {
  input: string;
  expectedOutput?: string;
  context?: ProjectContext;
}

export interface ComplexityAnalysis {
  overall: number;
  cyclomatic: number;
  cognitive: number;
  functions: number;
  classes: number;
  interfaces: number;
  lines: number;
}

export interface WikiOutline {
  sections: WikiSection[];
  priority: number;
}

export interface WikiSection {
  name: string;
  required: boolean;
  priority: number;
  description?: string;
}

export interface ProviderVariants {
  [provider: string]: string;
}

export type DocumentationType = "api" | "component" | "utility" | "service" | "config" | "unknown";

export interface QualityMetrics {
  clarity: number;
  completeness: number;
  specificity: number;
  consistency: number;
}

export interface PromptTestResult {
  score: number;
  issues: string[];
  suggestions: string[];
  passed: boolean;
}

export interface QualityThreshold {
  minimum: number;
  target: number;
  maximum: number;
}

export interface StructureValidation {
  isValid: boolean;
  hasInstructions: boolean;
  hasContext: boolean;
  hasCodeSection: boolean;
  hasOutputFormat: boolean;
  issues: string[];
}

export interface ClarityScore {
  score: number;
  hasClearInstructions: boolean;
  hasStructure: boolean;
  hasExamples: boolean;
  issues: string[];
}

export interface SpecificityScore {
  score: number;
  specificTerms: string[];
  vagueTerms: string[];
  issues: string[];
}

export interface ConsistencyScore {
  score: number;
  formatConsistency: boolean;
  terminologyConsistency: boolean;
  issues: string[];
}

export interface QualityReport {
  overallScore: number;
  metrics: QualityMetrics;
  structure: StructureValidation;
  clarity: ClarityScore;
  specificity: SpecificityScore;
  consistency: ConsistencyScore;
  passed: boolean;
  recommendations: string[];
}

export interface ImprovementSuggestion {
  type: "clarity" | "completeness" | "specificity" | "consistency" | "structure" | "safety";
  priority: "high" | "medium" | "low";
  description: string;
  suggestedChange?: string;
}

export interface AmbiguityAnalysis {
  ambiguousTerms: string[];
  score: number;
  issues: string[];
}

export interface SafetyCheck {
  isSafe: boolean;
  harmfulPatterns: string[];
  warnings: string[];
}

export interface OutputValidation {
  isValid: boolean;
  hasFormatSpecification: boolean;
  hasExample: boolean;
  issues: string[];
}

export interface QualityAssuranceResult {
  passed: boolean;
  report: QualityReport;
  suggestions: ImprovementSuggestion[];
  canProceed: boolean;
}
