# Qwiki API Reference

This document provides detailed API documentation for Qwiki's LLM providers and extension commands.

**Important**: Qwiki is a local-only VS Code extension. All processing happens within the user's IDE. Code snippets are sent to external LLM providers (configured by the user) for documentation generation, but no data is stored on external servers.

## Table of Contents

1. [LLM Provider API](#llm-provider-api)
2. [Extension Commands](#extension-commands)
3. [Message Types](#message-types)
4. [Configuration API](#configuration-api)
5. [Error Handling](#error-handling)
6. [Provider Services API](#provider-services-api)
7. [Logging Infrastructure](#logging-infrastructure)

## LLM Provider API

### Current Architecture: Registry Pattern

**Important Note**: The system currently uses a **Registry Pattern**, not a Factory pattern as previously documented. Providers are statically instantiated and registered, not dynamically created.

### Core Interface

All LLM providers must implement the enhanced `LLMProvider` interface:

```typescript
interface LLMProvider {
  id: string;
  name: string;
  requiresApiKey: boolean;
  generate(params: GenerateParams, apiKey: string | undefined): Promise<GenerateResult>;
  listModels(): string[];
  getUiConfig?(): ProviderUiConfig;

  // Lifecycle and monitoring capabilities
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  healthCheck?(): Promise<HealthCheckResult>;
  getCapabilities?(): ProviderCapabilities;
  getMetadata?(): ProviderMetadata;
}
```

### Provider Metadata System

```typescript
interface ProviderMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  capabilities: ProviderCapabilities;
  dependencies: string[];
  minQwikiVersion: string;
  entryPoint: string;
}

interface ProviderCapabilities {
  maxTokens: number;
  supportedLanguages: string[];
  features: ProviderFeature[];
  streaming: boolean;
  functionCalling: boolean;
  documentationTypes: DocumentationType[];
  complexity: ComplexityRange;
}

interface ProviderManifest extends ProviderMetadata {
  manifestVersion: string;
  checksum: string;
}
```

### Provider Registration System

**Current Implementation with Dynamic Discovery**:

```typescript
// src/llm/providers/registry.ts
export class ProviderRegistry {
  private discoveryService: ProviderDiscoveryService;
  private lifecycleManager: ProviderLifecycleManagerService;
  private dependencyResolver: ProviderDependencyResolverService;

  async loadProviders(getSetting: GetSetting): Promise<Record<string, LLMProvider>> {
    // Dynamic provider discovery
    const discoveredProviders = await this.discoveryService.discoverProviders();

    // Dependency resolution
    const loadOrder = this.dependencyResolver.getLoadOrder(discoveredProviders);

    // Lifecycle management
    const providers: Record<string, LLMProvider> = {};
    for (const providerId of loadOrder) {
      const provider = await this.lifecycleManager.initializeProvider(providerId);
      if (provider) {
        providers[providerId] = provider;
      }
    }

    return providers;
  }

  // Provider management capabilities
  async reloadProviders(): Promise<void>;
  async addProviderDirectory(directoryPath: string): Promise<void>;
  async removeProviderDirectory(directoryPath: string): Promise<void>;
  getProviderMetadata(providerId: string): ProviderMetadata | null;
}
```

**Current Capabilities**:

- ✅ Dynamic provider discovery with manifest system
- ✅ Provider lifecycle management with state machine
- ✅ Automatic dependency resolution
- ✅ Hot-reloading of providers
- ✅ Runtime extensibility without core code changes

**Future Vision: Plugin Architecture**:

```typescript
// Planned: Dynamic provider discovery
interface ProviderPlugin {
  id: string;
  provider: () => Promise<LLMProvider>;
  capabilities: ProviderCapabilities;
}

// Providers will register themselves
registerProvider({
  id: "new-provider",
  capabilities: { maxTokens: 4096, features: ["streaming"] },
  provider: () => import("./new-provider").then((p) => new p.NewProvider()),
});
```

### Generate Parameters

```typescript
type GenerateParams = {
  snippet: string; // Code snippet to document
  languageId?: string; // Language identifier (e.g., 'typescript', 'python')
  filePath?: string; // File path context
  model?: string; // Specific model to use
  project?: {
    // Project context
    rootName?: string; // Project root name
    overview?: string; // Project overview
    filesSample?: string[]; // Sample files for context
    related?: Array<{
      // Related files
      path: string;
      preview?: string;
      line?: number;
      reason?: string;
    }>;
  };
};
```

### Generate Result

```typescript
type GenerateResult = {
  content: string; // Generated documentation
};
```

### Provider UI Configuration

```typescript
interface ProviderUiConfig {
  apiKeyUrl: string; // URL to get API key
  apiKeyInput: string; // API key input label
  additionalInfo?: string; // Additional help text
  modelFallbackIds?: string[]; // Fallback model IDs
  defaultModel?: string; // Default model selection
  customFields?: ProviderCustomField[]; // Custom configuration fields
}

interface ProviderCustomField {
  id: string; // Field identifier
  label: string; // Display label
  type: "text" | "select"; // Field type
  placeholder?: string; // Placeholder text
  options?: string[]; // Select options (for type 'select')
  defaultValue?: string; // Default value
}
```

### Data vs Logic Separation

**Current State Analysis**:

**✅ Well Separated**:

- Provider-specific HTTP logic and endpoints
- Model lists and availability
- UI configuration definitions
- API key requirements and validation

**⚠️ Partially Separated**:

- Prompt building (external `buildWikiPrompt` function)
- Error handling (inconsistent across providers)
- Parameter processing (some leakage to services)

**❌ Needs Improvement**:

- Configuration access patterns
- Standardized error types
- Provider capability discovery
- Runtime extensibility

**Future Improvements**:

- Provider-specific prompt strategies
- Standardized error handling with `ProviderError` class
- Dynamic capability discovery
- Better configuration abstraction

````

## Supported Providers

### Google AI Studio

- **Provider ID**: `google-ai-studio`
- **Requires API Key**: Yes
- **Configuration**:
  - Endpoint type: OpenAI-compatible or native
  - Base URL: Configurable through VS Code settings
- **Models**: Various Gemini models

### Z.ai

- **Provider ID**: `zai`
- **Requires API Key**: Yes
- **Configuration**:
  - Base URL: Configurable (OpenAI-compatible)
- **Models**: Configurable model selection

### OpenRouter

- **Provider ID**: `openrouter`
- **Requires API Key**: Yes
- **Configuration**: Standard OpenAI-compatible API
- **Models**: Multiple models available

### Cohere

- **Provider ID**: `cohere`
- **Requires API Key**: Yes
- **Configuration**: Direct Cohere API integration
- **Models**: Command, Command-Light, etc.

### HuggingFace

- **Provider ID**: `huggingface`
- **Requires API Key**: Yes
- **Configuration**: Inference API integration
- **Models**: Various open-source models

## Extension Commands

### Core Commands

#### Generate Wiki

**Command ID**: `generateWiki`

Generates documentation for selected code or file.

**Parameters**:
```typescript
{
  selection?: string;       // Selected text (optional)
  filePath?: string;        // File path (optional)
  languageId?: string;      // Language identifier
  providerId?: string;      // LLM provider ID
  model?: string;          // Specific model
}
````

**Returns**:

```typescript
{
  content: string; // Generated documentation
  provider: string; // Provider used
  model: string; // Model used
}
```

#### Get Selection

**Command ID**: `getSelection`

Gets the current editor selection.

**Parameters**: None

**Returns**:

```typescript
{
  selection: string; // Selected text
  filePath: string; // Current file path
  languageId: string; // Language identifier
  startLine: number; // Selection start line
  endLine: number; // Selection end line
}
```

#### Get Related Files

**Command ID**: `getRelated`

Finds files related to the current context.

**Parameters**:

```typescript
{
  filePath?: string;        // Reference file path
  maxResults?: number;      // Maximum number of results
}
```

**Returns**:

```typescript
{
  files: Array<{
    path: string;
    preview?: string;
    line?: number;
    reason?: string;
  }>;
}
```

### Configuration Commands

#### Save API Key

**Command ID**: `saveApiKey`

Saves an API key for a provider.

**Parameters**:

```typescript
{
  providerId: string; // Provider ID
  apiKey: string; // API key to save
}
```

### Prompt Template Commands

#### Create Prompt Template

**Command ID**: `createPromptTemplate`

Creates a new prompt template with metadata and variables.

**Parameters**:

```typescript
{
  name: string;
  content: string;
  variables?: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    defaultValue?: string;
  }>;
  metadata?: {
    category: string;
    language: string;
    provider: string;
    complexity: string;
    effectiveness?: number;
  };
}
```

**Returns**:

```typescript
{
  templateId: string;
}
```

#### Update Prompt Template

**Command ID**: `updatePromptTemplate`

Applies partial updates to an existing template.

**Parameters**:

```typescript
{
  id: string;
  name?: string;
  content?: string;
  metadata?: {
    category?: string;
    language?: string;
    provider?: string;
    complexity?: string;
    effectiveness?: number;
  };
}
```

**Returns**: `void`

#### Delete Prompt Template

**Command ID**: `deletePromptTemplate`

Deletes a prompt template by identifier.

**Parameters**:

```typescript
{
  id: string;
}
```

**Returns**: `void`

#### Get All Prompt Templates

**Command ID**: `getAllPromptTemplates`

Retrieves every stored template for the current project or workspace.

**Parameters**: `{ }`

**Returns**:

```typescript
{
  templates: PromptTemplate[];
}
```

#### Render Prompt Template

**Command ID**: `renderPromptTemplate`

Renders a template with context variables.

**Parameters**:

```typescript
{
  templateId: string;
  context: PromptContext;
}
```

**Returns**:

```typescript
{
  content: string;
}
```

### Wiki Aggregation Commands

#### Create Wiki Page

**Command ID**: `createWikiPage`

Creates a wiki page entry for the active project.

**Parameters**:

```typescript
{
  title: string;
  content: string;
  tags?: string[];
  metadata?: {
    author?: string;
    status?: string;
    priority?: string;
  };
}
```

**Returns**:

```typescript
{
  pageId: string;
}
```

#### Aggregate Wikis

**Command ID**: `aggregateWikis`

Runs the aggregation engine using the provided strategy.

**Parameters**:

```typescript
{
  projectId: string;
  strategy: {
    type: string;
    rules: Array<Record<string, unknown>>;
  }
}
```

**Returns**:

```typescript
{
  success: boolean;
  wiki?: AggregatedWiki;
  issues?: string[];
}
```

#### Get Wiki Statistics

**Command ID**: `getWikiStatistics`

Retrieves aggregate counts for pages, tags, and relationships.

**Parameters**:

```typescript
{
  projectId: string;
}
```

**Returns**:

```typescript
{
  statistics: {
    totalPages: number;
    totalTags: number;
    totalRelationships: number;
    lastUpdated: string;
  }
}
```

### Quality Assurance Commands

#### Calculate Quality Metrics

**Command ID**: `calculateQualityMetrics`

Analyzes content and returns metric scores.

**Parameters**:

```typescript
{
  content: string;
  context: DocumentationContext;
}
```

**Returns**:

```typescript
{
  metrics: QualityMetrics;
  qualityScore: number;
}
```

#### Generate Quality Report

**Command ID**: `generateQualityReport`

Produces a full quality report with issues and recommendations.

**Parameters**:

```typescript
{
  content: string;
  context: DocumentationContext;
}
```

**Returns**:

```typescript
{
  qualityReport: QualityReport;
}
```

#### Run QA Checks

**Command ID**: `runQAChecks`

Executes a QA workflow against provided content.

**Parameters**:

```typescript
{
  content: string;
  context: DocumentationContext;
  workflow: QAWorkflow;
}
```

**Returns**:

```typescript
{
  result: QACheckResult;
}
```

**Returns**: Success confirmation

#### Get API Keys

**Command ID**: `getApiKeys`

Lists all saved API keys.

**Parameters**: None

**Returns**:

```typescript
{
  providers: string[];      // List of provider IDs with saved keys
}
```

#### Delete API Key

**Command ID**: `deleteApiKey`

Deletes an API key for a provider.

**Parameters**:

```typescript
{
  providerId: string; // Provider ID
}
```

**Returns**: Success confirmation

#### Get Providers

**Command ID**: `getProviders`

Lists all available LLM providers.

**Parameters**: None

**Returns**:

```typescript
{
  providers: Array<{
    id: string;
    name: string;
    requiresApiKey: boolean;
    configured: boolean;
  }>;
}
```

#### Get Provider Configs

**Command ID**: `getProviderConfigs`

Gets UI configurations for all providers.

**Parameters**: None

**Returns**:

```typescript
{
  configs: Record<string, ProviderUiConfig>;
}
```

### Settings Commands

#### Save Setting

**Command ID**: `saveSetting`

Saves a configuration setting.

**Parameters**:

```typescript
{
  key: string; // Setting key
  value: any; // Setting value
}
```

**Returns**: Success confirmation

#### Get Configuration

**Command ID**: `getConfiguration`

Gets current configuration.

**Parameters**: None

**Returns**:

```typescript
{
  [key: string]: any;      // Configuration key-value pairs
}
```

#### Update Configuration

**Command ID**: `updateConfiguration`

Updates multiple configuration settings.

**Parameters**:

```typescript
{
  settings: Record<string, any>; // Settings to update
}
```

**Returns**: Success confirmation

### README Automation Commands

#### Update README

**Command ID**: `updateReadme`

Updates README file from saved wikis with approval workflow.

**Parameters**:

```typescript
{
  wikiIds: string[];           // IDs of wikis to use for generation
  providerId: string;          // Provider to use for generation
  model?: string;              // Model to use
  backupOriginal?: boolean;    // Create backup before update (default: true)
}
```

**Returns**:

```typescript
{
  success: boolean;
  preview?: ReadmePreview;     // Preview of changes
  requiresApproval: boolean;   // Whether approval is required
}
```

#### Approve README Update

**Command ID**: `approveReadmeUpdate`

Approves a pending README update and applies changes.

**Parameters**: None (uses pending update from UpdateReadmeCommand)

**Returns**:

```typescript
{
  success: boolean;
  backupPath?: string;         // Path to backup file
  sections: string[];          // Sections that were updated
}
```

#### Cancel README Update

**Command ID**: `cancelReadmeUpdate`

Cancels a pending README update.

**Parameters**: None

**Returns**: Success confirmation

#### Undo README

**Command ID**: `undoReadme`

Undoes the last README update by restoring from backup.

**Parameters**: None

**Returns**:

```typescript
{
  success: boolean;
  restoredFrom: string; // Backup file path
  timestamp: string; // Backup timestamp
}
```

#### Check README Backup State

**Command ID**: `checkReadmeBackupState`

Checks if a README backup exists and returns backup information.

**Parameters**: None

**Returns**:

```typescript
{
  hasBackup: boolean;
  backupPath?: string;
  timestamp?: string;
  canUndo: boolean;
}
```

### Provider Capability Commands

#### Get Provider Capabilities

**Command ID**: `getProviderCapabilities`

Gets detailed capabilities for a specific provider.

**Parameters**:

```typescript
{
  providerId: string; // Provider ID
}
```

**Returns**:

```typescript
{
  capabilities: {
    contextWindowSize: number; // Maximum context window in tokens
    maxOutputTokens: number;   // Maximum output tokens
    supportedLanguages: string[]; // Supported programming languages
    features: string[];        // Supported features (streaming, function-calling, etc.)
    complexity: {              // Complexity range the provider handles well
      min: number;
      max: number;
    };
  };
}
```

### Environment Status Commands

#### Get Environment Status

**Command ID**: `getEnvironmentStatus`

Gets current environment health status including language servers, providers, and background tasks.

**Parameters**: None

**Returns**:

```typescript
{
  status: {
    languageServersReady: boolean;
    backgroundTasksHealthy: boolean;
    providersHealthy: boolean;
    memoryUsageNormal: boolean;
    cachePerformanceGood: boolean;
  };
  warnings: string[];          // Array of warning messages
  details: {
    languageServers: {
      typescript: boolean;
      python: boolean;
      // ... other language servers
    };
    backgroundTasks: {
      activeCount: number;
      queuedCount: number;
    };
    providers: {
      [providerId: string]: {
        healthy: boolean;
        lastCheck: string;
      };
    };
  };
}
```

### Utility Commands

#### Open File

**Command ID**: `openFile`

Opens a file in the editor.

**Parameters**:

```typescript
{
  path: string;            // File path to open
  line?: number;           // Line number to focus
}
```

**Returns**: Success confirmation

## Message Types

### Webview to Extension

Messages sent from the webview to the extension follow this structure:

```typescript
interface WebviewMessage {
  command: string; // Command ID
  requestId?: string; // Request identifier for async operations
  params?: any; // Command parameters
}
```

### Extension to Webview

Responses from the extension to the webview:

```typescript
interface ExtensionMessage {
  type: "response" | "event" | "error";
  requestId?: string; // Original request ID
  data?: any; // Response data
  error?: string; // Error message (if type is 'error')
}
```

## Configuration API

### VS Code Settings

The extension exposes the following VS Code settings:

```json
{
  "qwiki.zaiBaseUrl": {
    "type": "string",
    "default": "",
    "description": "Z.ai API base URL (OpenAI-compatible)"
  },
  "qwiki.googleAIEndpoint": {
    "type": "string",
    "enum": ["openai-compatible", "native"],
    "default": "openai-compatible",
    "description": "Google AI Studio endpoint type"
  }
}
```

### Runtime Configuration

Configuration is managed through the `ConfigurationManagerService` service:

- **API Keys**: Stored securely using VS Code's secret storage
- **Provider Settings**: Provider-specific configuration
- **User Preferences**: Customizable user settings

## Error Handling

### Error Types

The extension uses standardized error classes for different error scenarios:

```typescript
class ProviderError extends Error {
  code: string;
  message: string;
  providerId?: string;
  originalError?: any;

  constructor(code: string, message: string, providerId?: string, originalError?: any);
  toJSON(): ErrorObject;
  static fromError(error: any, providerId?: string): ProviderError;
}

interface ErrorObject {
  code: string;
  message: string;
  providerId?: string;
  originalError?: any;
}
```

### Error Recovery Service

```typescript
class ErrorRecoveryService {
  canRetry(error: ProviderError): boolean;
  getRetryDelay(attempt: number, error: ProviderError): number;
  shouldFallback(error: ProviderError): boolean;
  getUserFriendlyMessage(error: ProviderError): string;
  getActionableSuggestion(error: ProviderError): string;
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  type: "error";
  code: string; // Error code
  message: string; // Human-readable error message
  suggestions?: string[]; // Actionable suggestions
  retryable?: boolean; // Whether the operation can be retried
  requestId?: string; // Original request ID
}
```

### Standardized Error Codes

#### Provider Errors

- `PROVIDER_NOT_FOUND`: Requested provider is not available
- `PROVIDER_UNHEALTHY`: Provider health check failed
- `PROVIDER_INITIALIZATION_FAILED`: Provider failed to initialize

#### Authentication Errors

- `API_KEY_MISSING`: Required API key is not configured
- `API_KEY_INVALID`: API key is invalid or expired
- `API_KEY_REVOKED`: API key has been revoked

#### Model Errors

- `MODEL_NOT_SUPPORTED`: Requested model is not supported by provider
- `MODEL_NOT_AVAILABLE`: Model is temporarily unavailable
- `MODEL_CONTEXT_EXCEEDED`: Input exceeds model's context window

#### Network Errors

- `NETWORK_ERROR`: Network connection failed
- `NETWORK_TIMEOUT`: Request timed out
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `RATE_LIMIT_RETRY_AFTER`: Rate limit with retry-after header

#### Configuration Errors

- `VALIDATION_ERROR`: Invalid parameters provided
- `CONFIGURATION_ERROR`: Configuration is invalid
- `CONFIGURATION_MIGRATION_FAILED`: Failed to migrate configuration
- `CONFIGURATION_BACKUP_FAILED`: Failed to create configuration backup

#### Generation Errors

- `GENERATION_FAILED`: Documentation generation failed
- `GENERATION_TIMEOUT`: Generation request timed out
- `GENERATION_CANCELLED`: Generation was cancelled

## Usage Examples

### Generate Documentation

````typescript
// From webview
const message = {
  command: 'generateWiki',
  params: {
    selection: 'function example() { return "hello"; }',
    languageId: 'javascript',
    providerId: 'openrouter',
    model: 'gpt-3.5-turbo'
  }
};

// Response
{
  type: 'response',
  requestId: 'req-123',
  data: {
    content: '```javascript\n/**\n * Example function that returns a greeting\n * @returns {string} The greeting "hello"\n */\nfunction example() { return "hello"; }\n```',
    provider: 'openrouter',
    model: 'gpt-3.5-turbo'
  }
}
````

### Configure Provider

```typescript
// Save API key
{
  command: 'saveApiKey',
  params: {
    providerId: 'google-ai-studio',
    apiKey: 'your-api-key-here'
  }
}

// Get provider configs
{
  command: 'getProviderConfigs'
}

// Response
{
  type: 'response',
  data: {
    configs: {
      'google-ai-studio': {
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        apiKeyInput: 'Google AI Studio API Key',
        additionalInfo: 'Get your API key from Google AI Studio',
        defaultModel: 'gemini-pro'
      }
    }
  }
}
```

## Development Notes

### Architecture Reality Check

**Current State**: The LLM provider system uses a **Registry Pattern** with static instantiation, not a Factory pattern. While functional, this has limitations for extensibility.

**Key Architectural Insights**:

- **Data Concentration**: Provider-specific data IS well concentrated in the providers folder
- **Logic Separation**: Mostly successful, but some leakage exists (prompt building, error handling)
- **Extensibility**: Limited - requires core code changes to add providers
- **Future Evolution**: Moving toward plugin architecture for true extensibility

### Adding New Providers

**Current Process**:

1. Implement `LLMProvider` interface
2. Add to hardcoded registry in `src/llm/providers/registry.ts`
3. Provider handles its own HTTP logic, models, and configuration

**Limitations**:

- Registry modification required
- No runtime discovery
- Tight coupling to core system

**Future Plugin System**:

- Dynamic provider registration
- Capability-based discovery
- No core code modifications needed

### Performance Considerations

- Use cached services for repeated operations
- Implement proper error handling for network requests
- Consider rate limiting for API calls
- Optimize message passing between webview and extension

### Architectural Debt

**Known Issues**:

1. **Registry vs Factory**: Documentation incorrectly claims Factory pattern
2. **Error Handling**: Inconsistent across providers
3. **Configuration Leakage**: Some provider knowledge in services

**Recent Improvements**:

1. ✅ **Dynamic Provider Discovery**: Provider discovery service with manifest system
2. ✅ **Standardized Errors**: Consistent error types and handling
3. ✅ **Better Separation**: Reduced configuration leakage through validation engine
4. ✅ **Smart Selection**: Context-aware provider selection with fallback
5. ✅ **Performance Optimization**: Caching, batching, and background processing

**Planned Improvements**:

1. **Plugin Architecture**: True plugin system with hot-swapping
2. **Advanced AI Features**: Multi-provider generation and ensembles
3. **Enterprise Features**: Team management and collaboration

## Provider Services API

### Provider Discovery Service

```typescript
class ProviderDiscoveryService {
  constructor(
    private fileSystemService: ProviderFileSystemService,
    private eventBus: EventBus
  );

  async discoverProviders(): Promise<ProviderMetadata[]>;
  async scanDirectory(directoryPath: string): Promise<ProviderMetadata[]>;
  validateProviderManifest(manifest: any): ValidationResult;
  async loadProviderFromMetadata(metadata: ProviderMetadata): Promise<LLMProvider>;
  startWatching(directories: string[]): void;
  stopWatching(): void;
  getDiscoveredProviders(): ProviderMetadata[];
}
```

### Provider Lifecycle Manager Service

```typescript
class ProviderLifecycleManagerService {
  constructor(
    private discoveryService: ProviderDiscoveryService,
    private eventBus: EventBus
  );

  async initializeProvider(providerId: string): Promise<void>;
  async disposeProvider(providerId: string): Promise<void>;
  async restartProvider(providerId: string): Promise<void>;
  getProviderState(providerId: string): ProviderState;
  getAllProviderStates(): Record<string, ProviderState>;
  async healthCheckProvider(providerId: string): Promise<HealthCheckResult>;
}

enum ProviderState {
  'unloaded' = 'unloaded',
  'loading' = 'loading',
  'loaded' = 'loaded',
  'initializing' = 'initializing',
  'ready' = 'ready',
  'error' = 'error',
  'disposing' = 'disposing'
}
```

### Smart Provider Selection Service

```typescript
class SmartProviderSelectionService {
  constructor(
    private providerRegistry: ProviderRegistry,
    private contextAnalysisService: ContextAnalysisService,
    private providerPerformanceService: ProviderPerformanceService
  );

  async selectOptimalProvider(
    context: CodeContext,
    criteria?: SelectionCriteria
  ): Promise<string>;

  async scoreProvider(
    providerId: string,
    requirements: ContextRequirements
  ): Promise<ProviderScore>;

  async rankProviders(
    requirements: ContextRequirements
  ): Promise<ProviderRanking[]>;

  async getSelectionExplanation(
    providerId: string,
    context: CodeContext
  ): Promise<string>;
}

interface SelectionCriteria {
  prioritizeCost?: boolean;
  prioritizeSpeed?: boolean;
  prioritizeQuality?: boolean;
  excludeProviders?: string[];
  preferredProviders?: string[];
}
```

### Configuration Validation Engine Service

```typescript
class ConfigurationValidationEngineService {
  validateConfiguration(
    config: any,
    schema: ValidationSchema,
    context: ValidationContext,
  ): ValidationResult;

  addValidationRule(rule: ValidationRule): void;
  removeValidationRule(ruleId: string): void;
  getValidationRules(): ValidationRule[];
}

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  validator: (value: any, context: ValidationContext) => ValidationResult;
  severity: "error" | "warning" | "info";
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  correctedValue?: any;
}
```

### Configuration Template Service

```typescript
class ConfigurationTemplateService {
  createTemplate(config: any, metadata: TemplateMetadata): ConfigurationTemplate;

  async applyTemplate(templateId: string, variables: Record<string, any>): Promise<void>;

  validateTemplate(template: ConfigurationTemplate): ValidationResult;
  getAvailableTemplates(): ConfigurationTemplate[];
  async saveTemplate(template: ConfigurationTemplate): Promise<void>;
  async deleteTemplate(templateId: string): Promise<void>;
}

interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  metadata: TemplateMetadata;
  variables: TemplateVariable[];
  configuration: any;
}

interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  description: string;
  defaultValue?: any;
  required: boolean;
  options?: string[];
}
```

### Performance Optimization Services

```typescript
class CachingService {
  async get<T>(key: string): Promise<T | null>;
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<void>;
  async delete(key: string): Promise<void>;
  async clear(): Promise<void>;
  getStatistics(): CacheStatistics;
  async evictExpired(): Promise<void>;
}

interface CacheOptions {
  ttl?: number;
  priority?: number;
  tags?: string[];
}

class GenerationCacheService {
  constructor(private cachingService: CachingService);

  async getCachedGeneration(
    params: GenerateParams
  ): Promise<GenerateResult | null>;

  async cacheGeneration(
    params: GenerateParams,
    result: GenerateResult
  ): Promise<void>;

  generateCacheKey(params: GenerateParams): string;
  async invalidateCache(pattern: string): Promise<void>;
  async warmCache(commonParams: GenerateParams[]): Promise<void>;
}

class RequestBatchingService {
  batchRequest<T>(
    request: () => Promise<T>,
    options?: BatchOptions
  ): Promise<T>;

  async flushBatch(): Promise<void>;
  getBatchStatistics(): BatchStatistics;
  configureBatching(options: BatchOptions): void;
}

class BackgroundProcessingService {
  enqueueTask(task: BackgroundTask): string;
  dequeueTask(taskId: string): boolean;
  getTaskStatus(taskId: string): TaskStatus;
  async processQueue(): Promise<void>;
  pauseQueue(): void;
  resumeQueue(): void;
  getQueueStatistics(): QueueStatistics;
}
```

- `ProviderFallbackManagerService`
- `ProviderHealthService`
- `ProviderPerformanceService` (Orchestrator)

### Performance Monitoring Services

#### Metrics Collection Service

```typescript
// src/infrastructure/services/performance/MetricsCollectionService.ts
class MetricsCollectionService {
  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService
  );

  recordGenerationStart(providerId: string): string;
  recordGenerationEnd(
    requestId: string,
    success: boolean,
    tokensUsed?: number,
    error?: string
  ): PerformanceMetric | null;
  addMetric(providerId: string, metric: PerformanceMetric): void;
  cleanupOldMetrics(providerId: string, timeWindowMs: number): void;
  recordSelection(providerId: string): void;
  recordFallback(fromProviderId: string, toProviderId: string): void;
  clearProviderMetrics(providerId: string): void;
  clearAllMetrics(): void;
  getMetricsForProvider(providerId: string): PerformanceMetric[];
  getRecentMetrics(providerId: string, timeWindowMs?: number): PerformanceMetric[];
  exportMetrics(): Map<string, PerformanceMetric[]>;
  dispose(): void;
  recordCacheHit(providerId: string): void;
  recordCacheMiss(providerId: string): void;
  recordBatchOperation(providerId: string, batchSize: number): void;
  recordDebounceOperation(providerId: string): void;
  recordBackgroundTask(providerId: string, taskId: string): void;
  recordMemoryOptimization(providerId: string): void;
}
```

**Purpose**: Collects and manages performance metrics for LLM providers including generation times, success rates, token usage, and various operation types.

**Registered as**: `"metricsCollectionService"` in AppBootstrap

#### Statistics Calculation Service

```typescript
// src/infrastructure/services/performance/StatisticsCalculationService.ts
class StatisticsCalculationService {
  constructor(
    private llmRegistry: LLMRegistry,
    private loggingService: LoggingService
  );

  calculatePerformanceScore(stats: PerformanceStats): number;
  calculateProviderStats(providerId: string, metrics: PerformanceMetric[]): PerformanceStats;
  calculateProviderStatsFromMetrics(providerId: string, metrics: PerformanceMetric[]): PerformanceStats;
  getProviderStats(providerId: string, metricsMap: Map<string, PerformanceMetric[]>): PerformanceStats | null;
  getAllProviderStats(metricsMap: Map<string, PerformanceMetric[]>): Record<string, PerformanceStats>;
  getProviderRankings(metricsMap: Map<string, PerformanceMetric[]>): ProviderRanking[];
  getBestPerformingProvider(metricsMap: Map<string, PerformanceMetric[]>): string | null;
  getProvidersByPerformance(
    metricsMap: Map<string, PerformanceMetric[]>,
    minScore?: number
  ): ProviderRanking[];
  private getWeightedScore(stats: PerformanceStats): number;
}
```

**Purpose**: Calculates performance statistics and rankings from collected metrics including success rates, average response times, and performance scores.

**Registered as**: `"statisticsCalculationService"` in AppBootstrap

#### Performance Monitoring Service

```typescript
// src/infrastructure/services/performance/PerformanceMonitoringService.ts
class PerformanceMonitoringService {
  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService
  );

  updateProviderRanking(providerId: string, ranking: ProviderRanking): void;
  updateProviderRankings(rankings: ProviderRanking[]): void;
  getCacheStatistics(metricsMap: Map<string, PerformanceMetric[]>): CacheStatistics;
  getBatchStatistics(metricsMap: Map<string, PerformanceMetric[]>): BatchStatistics;
  getBackgroundTaskStatistics(metricsMap: Map<string, PerformanceMetric[]>): BackgroundTaskStatistics;
  getMemoryOptimizationStatistics(metricsMap: Map<string, PerformanceMetric[]>): MemoryOptimizationStatistics;
}
```

**Purpose**: Monitors and reports performance metrics, publishes performance events, and provides statistics for caching, batching, and background operations.

**Registered as**: `"performanceMonitoringService"` in AppBootstrap

#### Provider Performance Service (Orchestrator)

```typescript
// src/infrastructure/services/ProviderPerformanceService.ts
class ProviderPerformanceService {
  constructor(
    private metricsCollectionService: MetricsCollectionService,
    private statisticsCalculationService: StatisticsCalculationService,
    private performanceMonitoringService: PerformanceMonitoringService,
    private eventBus: EventBus,
    private loggingService: LoggingService
  );

  recordGenerationStart(providerId: string): string;
  recordGenerationEnd(requestId: string, success: boolean, tokensUsed?: number, error?: string): void;
  getProviderStats(providerId: string): PerformanceStats | null;
  getAllProviderStats(): Record<string, PerformanceStats>;
  getProviderRankings(): ProviderRanking[];
  getBestPerformingProvider(): string | null;
  clearProviderMetrics(providerId: string): void;
  clearAllMetrics(): void;
}
```

**Purpose**: Orchestrates performance monitoring by delegating to MetricsCollectionService, StatisticsCalculationService, and PerformanceMonitoringService. Follows orchestrator pattern.

**Registered as**: `"providerPerformanceService"` (lazy) in AppBootstrap

### Context Intelligence Service

```typescript
// src/application/services/ContextIntelligenceService.ts
class ContextIntelligenceService {
  async selectOptimalContext(
    targetFilePath: string,
    providerId: string,
    model?: string,
    onProgress?: (step: LoadingStep) => void,
  ): Promise<OptimalContextSelection>;

  calculateTokenBudget(
    capabilities: ProviderCapabilities,
    promptTemplateSize: number,
    outputEstimate: number,
  ): TokenBudget;
}

interface OptimalContextSelection {
  files: SelectedFile[];
  projectType: ProjectTypeDetection;
  essentialFiles: ProjectEssentialFile[];
  tokenUsage: {
    used: number;
    available: number;
    percentage: number;
  };
  relevanceScores: Map<string, number>;
  compressionApplied: boolean;
}

interface TokenBudget {
  totalTokens: number;
  reservedForPrompt: number;
  reservedForOutput: number;
  availableForContext: number;
  utilizationTarget: number;
}
```

**Purpose**: Orchestrates optimal context selection with token budget management. Ranks files by relevance, calculates token budgets, and selects the best context within provider limits.

**Workflow**:

1. Build/refresh project index
2. Detect project type and identify essential files
3. Calculate token budget for provider
4. Rank files by relevance to target
5. Select optimal files within budget
6. Apply compression if needed

### File Relevance Services

```typescript
// src/application/services/context/FileRelevanceAnalysisService.ts
class FileRelevanceAnalysisService {
  async analyzeRelevance(
    targetFile: string,
    candidateFile: string,
    projectType: ProjectTypeDetection,
  ): Promise<FileRelevanceScore>;
}

// src/application/services/context/FileRelevanceBatchService.ts
class FileRelevanceBatchService {
  async batchAnalyzeRelevance(
    targetFile: string,
    candidateFiles: string[],
    projectType: ProjectTypeDetection,
  ): Promise<FileRelevanceScore[]>;
}

// src/application/services/context/FileSelectionService.ts
class FileSelectionService {
  selectOptimalFiles(
    relevanceScores: FileRelevanceScore[],
    tokenBudget: TokenBudget,
    essentialFiles: ProjectEssentialFile[],
  ): SelectedFile[];
}

interface FileRelevanceScore {
  filePath: string;
  score: number;
  reasons: string[];
  relationships: {
    imports: boolean;
    exports: boolean;
    dependencies: boolean;
    usageFound: boolean;
  };
}
```

**Purpose**: Ranks files by relevance using dependencies, imports, exports, and symbol usage. Batch processing ensures O(n) complexity instead of O(n²).

### Project Indexing Services

```typescript
// src/infrastructure/services/ProjectIndexService.ts
class ProjectIndexService {
  async buildIndex(workspacePath: string): Promise<ProjectIndexCache>;
  async updateIndex(changedFiles: string[]): Promise<void>;
  async getSymbolInfo(filePath: string): Promise<SymbolInfo[]>;
  async findUsages(symbol: string): Promise<UsageLocation[]>;
}

interface ProjectIndexCache {
  files: Map<string, IndexedFile>;
  symbols: Map<string, SymbolInfo>;
  lastUpdated: number;
  version: string;
}

interface IndexedFile {
  path: string;
  language: string;
  imports: string[];
  exports: string[];
  symbols: string[];
  dependencies: string[];
  metadata: FileMetadata;
}
```

**Purpose**: Maintains fast-access index of project files with metadata extraction. Supports incremental updates via Git change detection.

### Context Analysis Services

#### Pattern Extraction Service

```typescript
// src/application/services/context/PatternExtractionService.ts
class PatternExtractionService {
  constructor(private loggingService: LoggingService);

  extractCodePatterns(snippet: string, language: string): CodePattern[];

  getFunctionRegex(language: string): RegExp;
  getClassRegex(language: string): RegExp;
  getInterfaceRegex(language: string): RegExp;
  getImportRegex(language: string): RegExp;
  getExportRegex(language: string): RegExp;
  getTypeRegex(language: string): RegExp;
  getVariableRegex(language: string): RegExp;
}

interface CodePattern {
  type: PatternType;
  name: string;
  description: string;
  confidence: number;
  location: {
    line: number;
    column: number;
  };
}

enum PatternType {
  FUNCTION_DECLARATION = "function-declaration",
  CLASS_DECLARATION = "class-declaration",
  INTERFACE_DECLARATION = "interface-declaration",
  TYPE_ALIAS = "type-alias",
  IMPORT_STATEMENT = "import-statement",
  EXPORT_STATEMENT = "export-statement",
  VARIABLE_DECLARATION = "variable-declaration",
  METHOD_CALL = "method-call",
  PROPERTY_ACCESS = "property-access",
  CONDITIONAL = "conditional",
  LOOP = "loop",
  ERROR_HANDLING = "error-handling",
  ASYNC_AWAIT = "async-await",
  PROMISE_CHAIN = "promise-chain",
  DESTRUCTURING = "destructuring",
  SPREAD_OPERATOR = "spread-operator",
  TEMPLATE_LITERAL = "template-literal",
  ARROW_FUNCTION = "arrow-function",
  GENERATOR_FUNCTION = "generator-function",
  DECORATOR = "decorator",
}
```

**Purpose**: Extracts code patterns (functions, classes, interfaces, imports, variables, control flow) from code snippets using language-specific regex patterns.

**Registered as**: `"patternExtractionService"` in AppBootstrap

#### Complexity Calculation Service

```typescript
// src/application/services/context/ComplexityCalculationService.ts
class ComplexityCalculationService {
  constructor(private loggingService: LoggingService);

  estimateContextComplexity(snippet: string, structure: CodeStructure): ComplexityScore;
  calculateMaxNestingDepth(snippet: string): number;
  calculateCyclomaticComplexity(structure: CodeStructure): number;
  calculateCognitiveComplexity(snippet: string, structure: CodeStructure): number;
  calculateHalsteadComplexity(
    snippet: string,
    structure: CodeStructure
  ): { volume: number; difficulty: number; effort: number };
}

interface ComplexityScore {
  overall: number;
  cyclomatic: number;
  cognitive: number;
  halstead: {
    volume: number;
    difficulty: number;
    effort: number;
  };
  lines: number;
  functions: number;
  classes: number;
  interfaces: number;
}
```

**Purpose**: Calculates code complexity metrics including cyclomatic complexity, cognitive complexity, Halstead complexity, and nesting depth.

**Registered as**: `"complexityCalculationService"` in AppBootstrap

#### Structure Analysis Service

```typescript
// src/application/services/context/StructureAnalysisService.ts
class StructureAnalysisService {
  constructor(
    private loggingService: LoggingService,
    private patternExtractionService: PatternExtractionService
  );

  analyzeCodeStructure(snippet: string, language: string, lines?: string[]): CodeStructure;

  private getVisibility(line: string): "public" | "private" | "protected";
  private extractParameters(functionSignature: string): ParameterInfo[];
  private extractExtends(line: string): string[];
  private extractImplements(line: string): string[];
  private extractProperties(line: string): PropertyInfo[];
  private extractMethods(line: string): MethodInfo[];
  private extractConstructors(line: string): ConstructorInfo[];
  private extractDecorators(line: string): string[];
  private extractExportType(exportLine: string): "default" | "named" | "namespace";
  private extractTypeDefinition(line: string): TypeAliasInfo | null;
  private extractImportElements(importLine: string): ImportInfo[];
}

interface CodeStructure {
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeAliasInfo[];
  imports: ImportInfo[];
  exports: ExportInfo[];
}
```

**Purpose**: Analyzes code structure by extracting functions, classes, interfaces, types, imports, and exports with detailed metadata (parameters, visibility, decorators, etc.).

**Registered as**: `"structureAnalysisService"` in AppBootstrap

#### Relationship Analysis Service

```typescript
// src/application/services/context/RelationshipAnalysisService.ts
class RelationshipAnalysisService {
  constructor(private loggingService: LoggingService);

  analyzeCodeRelationships(
    snippet: string,
    structure: CodeStructure,
    lines?: string[]
  ): CodeRelationship[];

  private buildCallGraph(
    lines: string[],
    functionMap: Map<string, FunctionInfo>
  ): Map<string, Array<{ callee: string; location: { line: number; column: number } }>>;
}

interface CodeRelationship {
  type: RelationshipType;
  source: { element: string; type: string; location: { line: number; column: number } };
  target: { element: string; type: string; location: { line: number; column: number } };
  strength: number;
  description: string;
}

enum RelationshipType {
  CALLS = "calls",
  IMPLEMENTS = "implements",
  EXTENDS = "extends",
  USES = "uses",
  IMPORTS = "imports",
  EXPORTS = "exports"
}
```

**Purpose**: Analyzes relationships between code elements including function calls, inheritance, implementations, and dependencies.

**Registered as**: `"relationshipAnalysisService"` in AppBootstrap

#### Context Analysis Service (Orchestrator)

```typescript
// src/application/services/ContextAnalysisService.ts
class ContextAnalysisService {
  constructor(
    private eventBus: EventBus,
    private loggingService: LoggingService,
    private complexityCalculationService: ComplexityCalculationService,
    private patternExtractionService: PatternExtractionService,
    private structureAnalysisService: StructureAnalysisService,
    private relationshipAnalysisService: RelationshipAnalysisService
  );

  async analyzeDeepContext(
    snippet: string,
    filePath: string,
    projectContext?: any
  ): Promise<DeepContextAnalysis>;
}
```

**Purpose**: Orchestrates deep code analysis by delegating to specialized services (PatternExtractionService, StructureAnalysisService, RelationshipAnalysisService, ComplexityCalculationService). Follows orchestrator pattern for clean separation of concerns.

**Registered as**: `"contextAnalysisService"` in AppBootstrap

### Data Transformation Layer

#### Wiki Transformer

```typescript
// src/application/transformers/WikiTransformer.ts
class WikiTransformer {
  static analyzeSnippet(snippet: string, languageId?: string): SnippetAnalysis;
  static extractSymbolCandidates(lines: string[]): string[];
  static summarizeContext(projectContext: ProjectContext): ContextSummary;
  static prepareGenerationInput(
    request: WikiGenerationRequest,
    projectContext: ProjectContext,
    analysis: SnippetAnalysis,
    contextSummary: ContextSummary,
  ): GenerationInput;
  static buildPromptSeed(generationInput: GenerationInput): string;
  static processGenerationResult(
    content: string,
    metadata: GenerationMetadata,
    promptSeed: string,
  ): ProcessedGeneration;
  static finalizeContent(processed: ProcessedGeneration, metadata: GenerationMetadata): string;
}

interface SnippetAnalysis {
  languageId?: string;
  lineCount: number;
  nonEmptyLineCount: number;
  characterCount: number;
  symbols: string[];
}

interface ContextSummary {
  relatedCount: number;
  relatedPaths: string[];
  hasOverview: boolean;
  hasRootName: boolean;
  filesSample: string[];
}

interface GenerationMetadata {
  analysis: SnippetAnalysis;
  context: ContextSummary;
}

interface GenerationInput {
  snippet: string;
  project: ProjectContext;
  metadata: GenerationMetadata;
}

interface ProcessedGeneration {
  content: string;
  metrics: {
    headingCount: number;
    listCount: number;
    paragraphCount: number;
    promptSeedLength: number;
  };
}
```

**Purpose**: Pure transformation functions for wiki generation data processing. Separates data transformation logic from business logic for perfect separation of concerns. All methods are static and have no side effects.

**Location**: `src/application/transformers/WikiTransformer.ts`

## Logging Infrastructure

### Backend (Extension Host)

```typescript
// src/infrastructure/services/LoggingService.ts
type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  service: string;
  message: string;
  data?: unknown;
}

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  includeTimestamp: boolean;
  includeService: boolean;
}

export class LoggingService {
  constructor(private config: LoggerConfig) {}
  debug(service: string, message: string, data?: unknown): void;
  info(service: string, message: string, data?: unknown): void;
  warn(service: string, message: string, data?: unknown): void;
  error(service: string, message: string, data?: unknown): void;
}
```

- Registered once in `AppBootstrap` (`loggingService` key)
- Injected into services/commands/events via DI container
- Default config: `{ enabled: false, level: "error", includeTimestamp: true, includeService: true }`
- Enable or adjust level via configuration manager when diagnostics required

### Frontend (Webview)

```typescript
// webview-ui/src/utilities/logging.ts
type LogLevel = "debug" | "info" | "warn" | "error";

export interface FrontendLoggerConfig {
  enabled: boolean;
  level: LogLevel;
  includeTimestamp: boolean;
  includeSource: boolean;
}

export const createLogger = (
  source: string,
  overrides?: Partial<FrontendLoggerConfig>,
) => ({
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
});
```

- Mirrors backend behaviour (level thresholds, metadata formatting)
- Default config: `{ enabled: true, level: "debug", includeTimestamp: true, includeSource: true }`
- Intended to replace all raw `console.*` usage inside `webview-ui`
- Forward logs to the extension by combining with `vscode.postMessage({ command: "frontendLog", ... })` when central aggregation is needed
