export enum PromptCategory {
  Documentation = "documentation",
  Explanation = "explanation",
  Summary = "summary",
  Analysis = "analysis",
  Custom = "custom",
}

export enum PromptComplexity {
  Simple = "simple",
  Moderate = "moderate",
  Complex = "complex",
}

export interface PromptVariable {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface PromptMetadata {
  category: PromptCategory;
  language: string;
  provider?: string;
  complexity: PromptComplexity;
  effectiveness?: number;
}

export interface PromptVersion {
  version: string;
  content: string;
  createdAt: string;
  author: string;
  changelog?: string;
}

export interface PromptContext {
  codeContext?: unknown;
  projectContext?: unknown;
  userPreferences?: unknown;
  history?: unknown;
}

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  content: string;
  variables: PromptVariable[];
  metadata: PromptMetadata;
}
