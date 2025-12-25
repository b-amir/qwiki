export interface ProviderConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  customFields?: Record<string, unknown>;
  rateLimitPerMinute?: number;
  timeout?: number;
  retryAttempts?: number;
  fallbackProviderIds?: string[];
}

export interface GlobalConfiguration {
  defaultProviderId?: string;
  autoGenerateWiki: boolean;
  wikiOutputFormat: "markdown" | "html" | "pdf";
  maxContextLength: number;
  enableCaching: boolean;
  cacheExpirationHours: number;
  enablePerformanceMonitoring: boolean;
  enableErrorReporting: boolean;
  logLevel: "error" | "warn" | "info" | "debug";
  uiTheme: "light" | "dark" | "auto";
  language: string;
  autoSave: boolean;
  backupEnabled: boolean;
  backupRetentionDays: number;
  enableSemanticCaching: boolean;
  semanticSimilarityThreshold: number;
  semanticCacheMaxEntries: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
}

export interface ConfigurationSchema {
  version: string;
  fields: SchemaField[];
  dependencies?: SchemaDependency[];
}

export interface SchemaField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  defaultValue?: unknown;
  validation?: FieldValidation;
  description?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  custom?: (value: unknown) => boolean;
}

export interface SchemaDependency {
  field: string;
  dependsOn: string;
  condition: (value: unknown) => boolean;
  action: "show" | "hide" | "enable" | "disable";
}

export type ConfigurationKey =
  | "defaultProviderId"
  | "autoGenerateWiki"
  | "wikiOutputFormat"
  | "maxContextLength"
  | "enableCaching"
  | "cacheExpirationHours"
  | "enablePerformanceMonitoring"
  | "enableErrorReporting"
  | "logLevel"
  | "uiTheme"
  | "language"
  | "autoSave"
  | "backupEnabled"
  | "backupRetentionDays"
  | "enableSemanticCaching"
  | "semanticSimilarityThreshold"
  | "semanticCacheMaxEntries";

export type ProviderConfigurationMap = Record<string, ProviderConfiguration>;

export interface ExportedConfiguration {
  version: string;
  exportedAt: string;
  global: Partial<GlobalConfiguration>;
  providers: ProviderConfigurationMap;
  templates?: Record<string, ConfigurationTemplate>;
  metadata: {
    exportedBy: string;
    description?: string;
  };
}

export interface ConfigurationBackup {
  id: string;
  createdAt: string;
  description?: string;
  configuration: ExportedConfiguration;
  size: number;
  compressed: boolean;
}

export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  category: "development" | "production" | "enterprise" | "custom";
  configuration: {
    global: Partial<GlobalConfiguration>;
    providers: ProviderConfigurationMap;
  };
  metadata: {
    author: string;
    version: string;
    tags: string[];
    compatibleProviders: string[];
  };
}

export interface TemplateMetadata {
  name: string;
  description: string;
  category: string;
  author: string;
  tags: string[];
}

export interface MigrationStep {
  version: string;
  description: string;
  migrate: (config: unknown) => Promise<unknown>;
  rollback: (config: unknown) => Promise<unknown>;
}

export interface HealthCheckResult {
  healthy: boolean;
  responseTime: number;
  lastChecked: string;
  errors?: string[];
}

export interface PerformanceMetrics {
  providerId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: string;
  errorRate: number;
}

export interface ProviderRanking {
  providerId: string;
  score: number;
  metrics: PerformanceMetrics;
}

export interface HealthStatus {
  providerId: string;
  healthy: boolean;
  lastChecked: string;
  responseTime?: number;
  errors?: string[];
}

export interface CapabilityRequirement {
  feature: string;
  required: boolean;
  priority: number;
}

export interface GenerationContext {
  language: string;
  fileSize: number;
  complexity: "low" | "medium" | "high";
  features: string[];
}

export interface TokenLimits {
  maxTotalTokens: number;
  reservedForPrompt: number;
  reservedForOutput: number;
  utilizationTarget: number;
}

export interface CompressionSettings {
  enabled: boolean;
  strategy: "none" | "light" | "moderate" | "aggressive";
  ratio: number;
  quality: number;
  preserveEssentials: boolean;
}

export interface ContextIntelligenceConfig {
  enableSmartContext: boolean;
  tokenLimits: TokenLimits;
  compressionSettings: CompressionSettings;
  minRelevanceScore: number;
  maxFilesToAnalyze: number;
  essentialFilesPriority: boolean;
}

export interface QualityThresholds {
  minQualityScore: number;
  targetQualityScore: number;
  qualityImprovementThreshold: number;
}

export interface ProviderOptimizations {
  providerId: string;
  customPromptTemplates?: Record<string, string>;
  qualityThreshold?: number;
  adaptiveStrategies?: string[];
}

export interface PromptEngineeringConfig {
  enableAdaptivePrompts: boolean;
  qualityThresholds: QualityThresholds;
  providerOptimizations: ProviderOptimizations[];
  enableA_BTesting: boolean;
  enablePromptEvolution: boolean;
}

export interface ReadmeUpdateSettings {
  enabled: boolean;
  autoBackup: boolean;
  preserveCustomSections: boolean;
  defaultSections: string[];
  mergeStrategy: "replace" | "merge" | "append";
  maxWikisPerUpdate?: number; // Default: 20
  timeout?: number; // Default: 90000 (90 seconds)
  enableCaching?: boolean; // Default: true
  cacheTTL?: number; // Default: 3600000 (1 hour)
  enableStreaming?: boolean; // Default: false
}

export interface WikiManagementConfig {
  enableAggregation: boolean;
  readmeUpdateSettings: ReadmeUpdateSettings;
  autoBackup: boolean;
  backupRetentionDays: number;
  aggregationDefaults: {
    mergeStrategy: "append" | "merge" | "replace";
    outputFormat: "markdown" | "html";
  };
}

export interface Phase4Configuration {
  contextIntelligence?: ContextIntelligenceConfig;
  promptEngineering?: PromptEngineeringConfig;
  wikiManagement?: WikiManagementConfig;
}
