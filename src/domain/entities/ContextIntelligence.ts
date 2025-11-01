export interface TokenBudget {
  totalTokens: number;
  reservedForPrompt: number;
  reservedForOutput: number;
  availableForContext: number;
  utilizationTarget: number;
}

export interface FileRelevanceMetadata {
  isDependency: boolean;
  isImportedBy: string[];
  importsFrom: string[];
  semanticSimilarity: number;
  lastModified: Date;
  complexity: number;
  fileCategory: "config" | "source" | "test" | "docs";
}

export interface FileRelevanceScore {
  filePath: string;
  score: number;
  relevanceType: "dependency" | "semantic" | "structural" | "essential";
  tokenCost: number;
  compressionRatio: number;
  metadata: FileRelevanceMetadata;
}

export interface ProjectEssentialFile {
  filePath: string;
  priority: "critical" | "high" | "medium" | "low";
  contentType: "package-manager" | "config" | "env" | "build" | "types";
  tokenCost: number;
  compressionStrategy: CompressionStrategy;
}

export interface OptimalContextSelection {
  selectedFiles: FileRelevanceScore[];
  essentialFiles: ProjectEssentialFile[];
  totalTokenCost: number;
  utilizationRate: number;
  excludedFiles: FileRelevanceScore[];
  compressionApplied: boolean;
}

export type CompressionStrategy = "none" | "light" | "moderate" | "aggressive";

export interface ProjectTypeDetection {
  primaryLanguage: string;
  framework?: string;
  buildSystem?: string;
  packageManager?: string;
  confidence: number;
}

