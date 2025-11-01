import type { ProjectContext } from "./Selection";

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
