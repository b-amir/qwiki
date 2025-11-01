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

export interface DependencyMap {
  imports: string[];
  exports: string[];
  dependencies: string[];
  dependents: string[];
}

export interface CompressionStrategyConfig {
  name: CompressionStrategy;
  ratio: number;
  quality: number;
}

export interface CompressedContent {
  original: string;
  compressed: string;
  metadata: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    strategy: CompressionStrategy;
    tokensSaved: number;
  };
}

export interface KeyInfo {
  type: "function" | "class" | "interface" | "variable" | "import" | "export" | "config";
  name: string;
  value: string;
  importance: number;
  location?: {
    line: number;
    column: number;
  };
}
