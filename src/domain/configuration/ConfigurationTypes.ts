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
  customFields?: Record<string, any>;
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
  defaultValue?: any;
  validation?: FieldValidation;
  description?: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: any[];
  custom?: (value: any) => boolean;
}

export interface SchemaDependency {
  field: string;
  dependsOn: string;
  condition: (value: any) => boolean;
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
  | "backupRetentionDays";

export type ProviderConfigurationMap = Record<string, ProviderConfiguration>;

export interface ExportedConfiguration {
  version: string;
  exportedAt: string;
  global: GlobalConfiguration;
  providers: ProviderConfigurationMap;
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
  migrate: (config: any) => Promise<any>;
  rollback: (config: any) => Promise<any>;
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
