# Qwiki API Reference

This document provides detailed API documentation for Qwiki's LLM providers and extension commands.

**Important**: Qwiki is a local-only VS Code extension. All processing happens within the user's IDE. Code snippets are sent to external LLM providers (configured by the user) for documentation generation, but no data is stored on external servers.

## Table of Contents

1. [LLM Provider API](#llm-provider-api)
2. [Extension Commands](#extension-commands)
3. [Message Types](#message-types)
4. [Initialization Readiness Events](#initialization-readiness-events)
5. [Configuration API](#configuration-api)
6. [Error Handling](#error-handling)
7. [Provider Services API](#provider-services-api)
8. [Navigation System API](#navigation-system-api)
9. [Logging Infrastructure](#logging-infrastructure)

## LLM Provider API

### Current Architecture: Registry Pattern

**Important Note**: The system uses a **Registry Pattern**. Providers are statically instantiated and registered, not dynamically created.

### Core Interface

All LLM providers must implement the enhanced `LLMProvider` interface:

```typescript
interface LLMProvider {
  id: string;
  name: string;
  requiresApiKey: boolean;
  capabilities: ProviderCapabilities;
  generate(params: GenerateParams, apiKey: string | undefined): Promise<GenerateResult>;
  listModels(): string[];
  getUiConfig?(): ProviderUiConfig;
  supportsCapability(capability: ProviderFeature): boolean;
  validateConfig(config: unknown): ValidationResult;
  getModelCapabilities?(model?: string): ProviderCapabilities;

  // Lifecycle and monitoring capabilities
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
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

At runtime the extension resolves providers through `LLMRegistry` (`src/llm/index.ts`). The registry loads the built-in catalog via `loadProviders()` and exposes helper methods for configuration, health checks, and generation:

```typescript
export class LLMRegistry {
  private providers = new Map<string, LLMProvider>();

  constructor(
    private secrets: SecretStorage,
    private errorRecoveryService: ErrorRecoveryService,
    private errorLoggingService: ErrorLoggingService,
    private configurationManager: ConfigurationManagerService,
    getSetting?: GetSetting,
  ) {
    const allProviders = loadProviders(getSetting || (async () => undefined));
    for (const [id, provider] of Object.entries(allProviders)) {
      this.providers.set(id, provider);
    }
  }

  list() {
    /* ... */
  }
  getProvider(providerId: ProviderId) {
    /* ... */
  }
  async generate(providerId: ProviderId, params: GenerateParams) {
    /* ... */
  }
  async getProviderConfigs(): Promise<ProviderConfig[]> {
    /* ... */
  }
  async healthCheckProvider(providerId: ProviderId): Promise<HealthCheckResult> {
    /* ... */
  }
}
```

The discovery and lifecycle services under `src/llm/providers` support provider management and lifecycle operations.

**Current Capabilities**:

- ✅ Built-in provider catalog (Google AI Studio, Z.ai, OpenRouter, Cohere, Hugging Face)
- ✅ Provider configuration and secret management through `ConfigurationManagerService` and VS Code `SecretStorage`
- ✅ Capability introspection (`listModels`, `getModelCapabilities`, `capabilities` metadata)
- ✅ Health checks and API-key validation helpers via `healthCheck`/`healthCheckWithKey`
- ✅ Retry and structured error logging through `ErrorRecoveryService` and `ErrorLoggingService`

### Generate Parameters

```typescript
type GenerateParams = {
  snippet: string; // Code snippet to document
  languageId?: string; // Language identifier (e.g., 'typescript', 'python')
  filePath?: string; // File path context
  model?: string; // Specific model to use
  semanticInfo?: SemanticCodeInfo; // Optional semantic data from language servers
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

```typescript
interface SemanticCodeInfo {
  symbolName: string;
  symbolKind: SymbolKind;
  location: Uri;
  type?: string;
  isAsync?: boolean;
  parameters?: Array<{ name: string; type?: string }>;
  returnType?: string;
  documentation?: string;
}
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

The provider system maintains clear separation between data and logic:

- Provider-specific HTTP logic and endpoints are encapsulated within each provider
- Model lists and availability are managed by individual providers
- UI configuration definitions are isolated in provider implementations
- API key requirements and validation are handled through the provider interface
- Prompt building uses the external `buildWikiPrompt` function for consistency
- Error handling follows standardized patterns across providers
- Configuration access flows through `ConfigurationManagerService`

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

### Command System Architecture

Commands are organized by domain into subdirectories (`commands/core/`, `commands/providers/`, `commands/configuration/`, `commands/wikis/`, `commands/readme/`, `commands/utilities/`) and created via specialized factories (`CoreCommandFactory`, `ProviderCommandFactory`, etc.).

**Command Metadata System:**

Commands are registered with metadata that includes grouping, readiness requirements, timeouts, and descriptions:

```typescript
interface CommandMetadata {
  id: string;
  group: CommandGroup;
  requiresReadiness?: string[]; // Service IDs that must be ready
  timeout?: number; // Command timeout in milliseconds
  description?: string; // Human-readable description
}

type CommandGroup =
  | "core"
  | "providers"
  | "configuration"
  | "wikis"
  | "readme"
  | "utilities";
```

**Command Factory System:**

Commands are created through specialized factories that extend `BaseCommandFactory`:

- `CoreCommandFactory`: Creates core commands (generateWiki, getSelection, getRelated)
- `ProviderCommandFactory`: Creates provider management commands
- `ConfigurationCommandFactory`: Creates configuration commands
- `WikiCommandFactory`: Creates wiki storage commands
- `ReadmeCommandFactory`: Creates README automation commands
- `UtilityCommandFactory`: Creates utility commands

The main `CommandFactory` orchestrates these specialized factories to create commands with proper dependency injection.

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

### Wiki Storage Commands

#### Save Wiki

**Command ID**: `saveWiki`

Persists a generated wiki entry to the `.qwiki/saved` directory.

**Parameters**:

```typescript
{
  title: string;
  content: string;
  sourceFilePath?: string;
}
```

**Returns**:

```typescript
{
  id: string;
  title: string;
  filePath: string;
  createdAt: string;
}
```

#### Get Saved Wikis

**Command ID**: `getSavedWikis`

Loads previously saved wiki entries from disk.

**Parameters**: None

**Returns**:

```typescript
{
  wikis: Array<{
    id: string;
    title: string;
    content: string;
    filePath: string;
    createdAt: string;
    tags: string[];
    sourceFilePath?: string;
  }>;
}
```

#### Delete Wiki

**Command ID**: `deleteWiki`

Removes a wiki entry from the saved wiki store.

**Parameters**:

```typescript
{
  wikiId: string;
}
```

**Returns**:

```typescript
{
  wikiId: string;
}
```

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

Lists the available LLM providers along with model lists and API-key status.

**Parameters**: None

**Returns**:

```typescript
{
  providers: Array<{
    id: string;
    name: string;
    models: string[];
    hasKey: boolean;
  }>;
}
```

#### Get Provider Configs

**Command ID**: `getProviderConfigs`

Retrieves UI configuration metadata for each provider. The registry post-processes the data to include any persisted custom fields.

**Parameters**: None

**Returns**:

```typescript
{
  configs: Array<{
    id: string;
    name: string;
    apiKeyUrl: string;
    apiKeyInput: string;
    additionalInfo?: string;
    modelFallbackIds?: string[];
    defaultModel?: string;
    customFields?: ProviderCustomField[];
  }>;
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
  value: unknown; // Setting value
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
  [key: string]: unknown;      // Configuration key-value pairs
}
```

#### Update Configuration

**Command ID**: `updateConfiguration`

Updates multiple configuration settings.

**Parameters**:

```typescript
{
  settings: Record<string, unknown>; // Settings to update
}
```

**Returns**: Success confirmation

### README Automation Commands

#### Update README

**Command ID**: `updateReadme`

Updates README file from saved wikis with automatic diff preview.

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
  changes: string[];           // High-level change summary strings
  conflicts: string[];         // Reasons the update failed (empty on success)
  backupPath?: string;         // Path to backup file (present when backupOriginal=true)
}
```

- `readmeUpdateProgress`: Emits granular loading step updates while the workflow is active.
- `readmeUpdated`: Sent after the README write completes. A successful payload indicates that a VS Code diff view is available between the backup and the updated README (when backups are enabled).

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

#### Show README Diff

**Command ID**: `showReadmeDiff`

Opens the VS Code diff view comparing the current README with the most recent backup recorded during README automation.

**Parameters**: None

**Returns**: None (opens diff view or emits an error notification on failure)

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

Gets the normalized capability profile for each provider. An optional payload can request a specific provider/model combination.

**Parameters**:

```typescript
{
  providerId?: string;
  model?: string;
}
```

**Returns**:

```typescript
{
  capabilities: Record<
    string,
    {
      streaming: boolean;
      functionCalling: boolean;
      maxTokens: number;
      contextWindowSize: number;
    }
  >;
}
```

### Provider Validation Commands

#### Validate API Keys

**Command ID**: `validateApiKeys`

Runs provider configuration validation to ensure at least one API key is ready for use. Optionally validates the specified providers individually.

**Parameters**:

```typescript
{
  providerIds?: string[];
}
```

**Returns**:

```typescript
{
  globalValidation: ValidationResult;
  providerValidations: Record<string, ValidationResult>;
}

interface ValidationResult {
  isValid: boolean;
  errors: Array<{ code: string; message: string; field?: string }>;
  warnings: Array<{ code: string; message: string; field?: string }>;
}
```

#### Validate API Key Health

**Command ID**: `validateApiKeyHealth`

Performs a live health check against a provider using the supplied API key. The command is useful for onboarding and troubleshooting.

**Parameters**:

```typescript
{
  providerId: string;
  apiKey: string;
}
```

**Returns**:

```typescript
{
  providerId: string;
  isValid: boolean;
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
  errorCode?: string;
}
```

### Provider Monitoring Commands

#### Get Provider Health

**Command ID**: `getProviderHealth`

Returns cached health information for all providers or a specific provider.

**Parameters**:

```typescript
{
  providerId?: string;
}
```

**Returns**:

```typescript
{
  healthStatus: Record<
    string,
    {
      providerId: string;
      isHealthy: boolean;
      lastChecked: string;
      responseTime?: number;
      error?: string;
      consecutiveFailures: number;
    }
  >;
}
```

#### Get Provider Performance

**Command ID**: `getProviderPerformance`

Retrieves aggregated performance statistics collected by the background metrics pipeline.

**Parameters**:

```typescript
{
  providerId?: string;
}
```

**Returns**:

```typescript
{
  performanceStats: Record<
    string,
    {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
      successRate: number;
      lastRequestTime: string;
      averageTokensPerRequest?: number;
    }
  >;
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

#### Toggle Output Channel

**Command ID**: `toggleOutputChannel`

Shows or hides the Qwiki output channel in VS Code. No payload is required and no data is returned.

**Parameters**: None

**Returns**: `void`

## Message Types

### Webview to Extension

Messages sent from the webview to the extension follow this structure:

```typescript
interface WebviewMessage {
  command: string; // Command ID
  requestId?: string; // Request identifier for async operations
  params?: unknown; // Command parameters
}
```

### Extension to Webview

Responses from the extension to the webview:

```typescript
interface ExtensionMessage {
  type: "response" | "event" | "error";
  requestId?: string; // Original request ID
  data?: unknown; // Response data
  error?: string; // Error message (if type is 'error')
}
```

Common outbound events currently emitted by the extension include:

- `providers` – provider list and API-key status
- `providerConfigs` – UI configuration metadata for each provider
- `providerCapabilitiesRetrieved` – normalized capability map per provider
- `providerHealthRetrieved` – latest health status map from `ProviderHealthService`
- `providerPerformanceRetrieved` – aggregated performance stats per provider
- `apiKeysValidated` – results from `validateApiKeys`
- `apiKeyHealthValidated` – live API-key health check outcome
- `wikiSaved`, `savedWikisLoaded`, `wikiDeleted` – saved wiki lifecycle events
- `showNotification` – ephemeral toast notifications surfaced in the webview
- `environmentStatus`, `commandWaiting`, `loadingStep`, `wikiResult`, `error` – readiness, progress, and error reporting primitives

## Loading Step Progress Events

### `loadingStep` Event

The `loadingStep` event provides enhanced progress tracking with percentages, time estimates, and contextual messages:

```typescript
interface LoadingStepProgress {
  step: LoadingStep; // Current loading step identifier
  percentage: number; // Progress percentage (0-100)
  message: string; // Contextual progress message
  elapsed: number; // Elapsed time in milliseconds
  estimatedRemaining?: number; // Estimated time remaining in milliseconds (optional)
}
```

**Enhanced Features**:

- **Progress Percentages**: Calculated based on step order in the generation workflow
- **Time Estimates**: Estimated time remaining based on historical performance data
- **Contextual Messages**: Dynamic messages that include relevant context (file counts, token usage, etc.)
- **Progressive Warnings**: Timeout warnings at 60s, 70s, 80s, and 90s for long-running operations

**Example Payload**:

```typescript
{
  step: "analyzingFileRelevance",
  percentage: 25,
  message: "Analyzing file relevance (45/200 files)...",
  elapsed: 5000,
  estimatedRemaining: 15000
}
```

**Step Messages with Context**:

- `analyzingFileRelevance`: Includes file count and analyzed count (e.g., "Analyzing file relevance (45/200 files)...")
- `buildingContextSummary`: Includes selected file count (e.g., "Building context summary (12 files selected)...")
- `waitingForLLMResponse`: Includes token generation count (e.g., "Generating documentation (1250 tokens)...")

**Usage**: The frontend loading store (`webview-ui/src/stores/loading.ts`) receives these events and updates the UI with progress bars, percentages, and time estimates.

## Initialization Readiness Events

### Service Readiness Manager

- Service readiness data is centralized in `ServiceReadinessManager`.
- Service tiers, command requirements, timeouts, and immediate command sets are declared in `src/constants/ServiceTiers.ts`.
- Commands that require additional services call into the readiness manager before execution; immediate commands bypass the check.

### `commandWaiting` Event (webview)

When a command is deferred because required services are still initializing, the backend emits a `commandWaiting` event through `MessageBusService.postImmediate`:

```typescript
interface CommandWaitingPayload {
  command: string;
  waitingFor: string[]; // service IDs still initializing
  message: string; // user-facing hint, e.g. "Initializing projectIndexService..."
}
```

- The webview listens for this event to display progress banners, disable buttons, and surface contextual messaging.
- Once readiness is achieved the command is executed automatically; if the timeout defined in `COMMAND_TIMEOUTS` is reached, an error is published via the centralized error pipeline.

### Background Initialization Progress

- `InitializationOrchestrator.initializeBackgroundServices()` (called from `AppBootstrap`) publishes `backgroundInitProgress` via the event bus.
- Payload shape:

```typescript
interface BackgroundInitProgressEvent {
  completed: number;
  total: number;
  percent: number; // rounded integer
}
```

- `EnvironmentStatusManager` subscribes to the event and surfaces the values to the environment store so the UI can show initialization progress indicators.

### Environment Status Response

- `EnvironmentStatusManager.composeEnvironmentStatus()` now includes an `initializationProgress` field and readiness flags per service tier.
- The webview retrieves this data by sending `getEnvironmentStatus` (an immediate command) and reading the response payload:

```typescript
interface EnvironmentStatusResponse {
  initializationProgress: number; // 0-100 aggregate readiness
  criticalReady: boolean;
  backgroundReady: boolean;
  services: Record<
    string,
    {
      tier: "critical" | "background" | "optional";
      status: "pending" | "initializing" | "ready" | "failed";
      initDuration?: number;
    }
  >;
}
```

- Frontend stores (e.g. `environment.ts`) use this data to render readiness banners, enable/disable commands, and decide when to show degraded modes.

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

## Result Pattern

The Result pattern provides type-safe error handling for expected failures, making error handling explicit in the type system.

### Result Type

```typescript
type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };
```

### Helper Functions

```typescript
// Create success result
function ok<T>(value: T): Result<T, never>;

// Create error result
function err<E>(error: E): Result<never, E>;

// Type guards
function isOk<T, E>(result: Result<T, E>): result is { success: true; value: T };
function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E };

// Unwrap operations
function unwrap<T, E>(result: Result<T, E>): T;
function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T;
function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T;

// Transformations
function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>;
```

### Usage Example

```typescript
import { Result, ok, err, isOk } from "@/domain/types";

async function validateAndSaveWiki(wiki: Wiki): Promise<Result<void>> {
  const validation = validator.validate(wiki);
  if (!validation.isValid) {
    return err(new ValidationError(validation.errors));
  }

  try {
    await storage.save(wiki);
    return ok(undefined);
  } catch (error) {
    return err(error as Error);
  }
}

// Usage
const result = await validateAndSaveWiki(wiki);
if (isOk(result)) {
  logger.info("Wiki saved successfully");
} else {
  logger.error("Failed to save wiki", { error: result.error });
  messageBus.postError({
    code: "VALIDATION_ERROR",
    message: result.error.message,
    suggestions: ["Fix validation errors"],
    timestamp: Date.now(),
    context: { wikiId: wiki.id },
  });
}
```

**Location**: `src/domain/types/Result.ts`

**Exported from**: `src/domain/types/index.ts`

## Error Handling

### Error Types

The extension uses standardized error classes for different error scenarios:

```typescript
class ProviderError extends Error {
  code: string;
  message: string;
  providerId?: string;
  originalError?: unknown;

  constructor(code: string, message: string, providerId?: string, originalError?: unknown);
  toJSON(): ErrorObject;
  static fromError(error: unknown, providerId?: string): ProviderError;
}

interface ErrorObject {
  code: string;
  message: string;
  providerId?: string;
  originalError?: Error;
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

### Architecture Overview

The LLM provider system uses a **Registry Pattern** with dynamic discovery capabilities. Providers are registered through the provider registry and managed by lifecycle services.

**Key Architectural Features**:

- **Data Concentration**: Provider-specific data is consolidated in the providers folder
- **Logic Separation**: Clear boundaries between provider logic and application services
- **Extensibility**: Dynamic provider discovery with manifest system supports runtime extensibility

### Adding New Providers

**Process**:

1. Implement `LLMProvider` interface with required methods
2. Create provider manifest file with metadata and capabilities
3. Place provider files in discoverable directory or register in `src/llm/providers/registry.ts`
4. Provider handles its own HTTP logic, models, and configuration

**Capabilities**:

- Dynamic provider discovery with manifest validation
- Provider lifecycle management (initialize, dispose, health checks)
- Automatic dependency resolution between providers
- Hot-reloading support for provider updates

### Performance Considerations

- Cached services optimize repeated operations
- Proper error handling for network requests
- Rate limiting for API calls
- Optimized message passing between webview and extension
- Batch processing for relevance analysis
- Token budget management for context optimization

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
  validateProviderManifest(manifest: unknown): ValidationResult;
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
    config: unknown,
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
  validator: (value: unknown, context: ValidationContext) => ValidationResult;
  severity: "error" | "warning" | "info";
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  correctedValue?: unknown;
}
```

### Configuration Template Service

```typescript
class ConfigurationTemplateService {
  createTemplate(config: unknown, metadata: TemplateMetadata): ConfigurationTemplate;

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
  configuration: unknown;
}

interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "select";
  description: string;
  defaultValue?: unknown;
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

class RateLimiterService {
  constructor(
    loggingService: LoggingService,
    defaultConfig?: RateLimitConfig
  );

  getLimiter(key: string, config?: RateLimitConfig): RateLimiter;
  async checkLimit(key: string, config?: RateLimitConfig): Promise<void>;
  clearLimiter(key: string): void;
  clearAll(): void;
  getLimiterStats(key: string): { requestCount: number; oldestRequest: number | null } | null;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class LRUCache<K, V> {
  constructor(maxSize: number);

  set(key: K, value: V): void;
  get(key: K): V | undefined;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size(): number;
  getMaxSize(): number;
  keys(): IterableIterator<K>;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[K, V]>;
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
    _loggingService: LoggingService
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

**Registered as**: `"metricsCollectionService"` via `registerInfrastructureServices()` in `src/application/bootstrap/registrations/InfrastructureServiceRegistrations.ts`

#### Statistics Calculation Service

```typescript
// src/infrastructure/services/performance/StatisticsCalculationService.ts
class StatisticsCalculationService {
  constructor(
    private llmRegistry: LLMRegistry,
    _loggingService: LoggingService
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

**Registered as**: `"statisticsCalculationService"` via `registerInfrastructureServices()` in `src/application/bootstrap/registrations/InfrastructureServiceRegistrations.ts`

#### Performance Monitoring Service

```typescript
// src/infrastructure/services/performance/PerformanceMonitoringService.ts
class PerformanceMonitoringService {
  constructor(
    private eventBus: EventBus,
    _loggingService: LoggingService
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

**Registered as**: `"performanceMonitoringService"` via `registerInfrastructureServices()` in `src/application/bootstrap/registrations/InfrastructureServiceRegistrations.ts`

#### Provider Performance Service (Orchestrator)

```typescript
// src/infrastructure/services/ProviderPerformanceService.ts
class ProviderPerformanceService {
  constructor(
    private metricsCollectionService: MetricsCollectionService,
    private statisticsCalculationService: StatisticsCalculationService,
    private performanceMonitoringService: PerformanceMonitoringService,
    private eventBus: EventBus,
    _loggingService: LoggingService
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

**Registered as**: `"providerPerformanceService"` (lazy) via `registerProviderServices()` in `src/application/bootstrap/registrations/ProviderServiceRegistrations.ts`

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
  constructor(_loggingService: LoggingService);

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

**Registered as**: `"patternExtractionService"` via `registerContextServices()` in `src/application/bootstrap/registrations/ContextServiceRegistrations.ts`

#### Complexity Calculation Service

```typescript
// src/application/services/context/ComplexityCalculationService.ts
class ComplexityCalculationService {
  constructor(_loggingService: LoggingService);

  estimateContextComplexity(snippet: string, structure: CodeStructure): ComplexityScore;
  calculateMaxNestingDepth(snippet: string): number;
  calculateCyclomaticComplexity(structure: CodeStructure): number;
  calculateCognitiveComplexity(snippet: string, structure: CodeStructure): number;
  calculateHalsteadComplexity(
    snippet: string,
    structure: CodeStructure,
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

**Registered as**: `"complexityCalculationService"` via `registerContextServices()` in `src/application/bootstrap/registrations/ContextServiceRegistrations.ts`

#### Structure Analysis Service

```typescript
// src/application/services/context/StructureAnalysisService.ts
class StructureAnalysisService {
  constructor(
    _loggingService: LoggingService,
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

**Registered as**: `"structureAnalysisService"` via `registerContextServices()` in `src/application/bootstrap/registrations/ContextServiceRegistrations.ts`

#### Relationship Analysis Service

```typescript
// src/application/services/context/RelationshipAnalysisService.ts
class RelationshipAnalysisService {
  constructor(_loggingService: LoggingService);

  analyzeCodeRelationships(
    snippet: string,
    structure: CodeStructure,
    lines?: string[],
  ): CodeRelationship[];

  private buildCallGraph(
    lines: string[],
    functionMap: Map<string, FunctionInfo>,
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
  EXPORTS = "exports",
}
```

**Purpose**: Analyzes relationships between code elements including function calls, inheritance, implementations, and dependencies.

**Registered as**: `"relationshipAnalysisService"` via `registerContextServices()` in `src/application/bootstrap/registrations/ContextServiceRegistrations.ts`

#### Context Analysis Service (Orchestrator)

```typescript
// src/application/services/ContextAnalysisService.ts
class ContextAnalysisService {
  constructor(
    private eventBus: EventBus,
    _loggingService: LoggingService,
    private complexityCalculationService: ComplexityCalculationService,
    private patternExtractionService: PatternExtractionService,
    private structureAnalysisService: StructureAnalysisService,
    private relationshipAnalysisService: RelationshipAnalysisService
  );

  async analyzeDeepContext(
    snippet: string,
    filePath: string,
    projectContext?: unknown
  ): Promise<DeepContextAnalysis>;
}
```

**Purpose**: Orchestrates deep code analysis by delegating to specialized services (PatternExtractionService, StructureAnalysisService, RelationshipAnalysisService, ComplexityCalculationService). Follows orchestrator pattern for clean separation of concerns.

**Registered as**: `"contextAnalysisService"` via `registerContextServices()` in `src/application/bootstrap/registrations/ContextServiceRegistrations.ts`

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

## Navigation System API

### Navigation Store

**Location**: `webview-ui/src/stores/navigation.ts`

Single source of truth for navigation state with state machine pattern.

```typescript
interface NavigationState {
  currentPage: PageType;
  targetPage: PageType | null;
  state: "idle" | "validating" | "navigating" | "blocked";
  direction: "forward" | "back" | null;
  validationError: ValidationError | null;
  guard: NavigationGuard | null;
}

interface ValidationError {
  message: string;
  code: string;
  suggestions?: string[];
}

type NavigationGuard = (
  target: PageType,
  direction: "forward" | "back",
) => Promise<ValidationResult>;

interface ValidationResult {
  allowed: boolean;
  error?: ValidationError;
}

type PageType =
  | "wiki"
  | "settings"
  | "errorHistory"
  | "savedWikis"
  | "promptManager"
  | "qualityDashboard"
  | "wikiAggregator";
```

**Actions**:

```typescript
// Navigate to a page
async navigateTo(page: PageType, isBack?: boolean): Promise<boolean>

// Register navigation guard
setGuard(guard: NavigationGuard | null): void

// Handle backend navigation messages
handleNavigationMessage(page: PageType, isBack: boolean): void

// Internal state transitions (private)
_transitionTo(state: NavigationMachineState): void
_completeNavigation(): void
_blockNavigation(error: ValidationError): void
_resetToIdle(): void
```

**Getters**:

```typescript
// Is navigation in progress?
isNavigating: boolean

// Is currently validating?
isValidating: boolean

// Is navigation blocked?
isBlocked: boolean

// Get current validation error
currentError: ValidationError | null

// Is navigating to specific page?
isNavigatingTo(page: PageType): boolean
```

### useNavigation Composable

**Location**: `webview-ui/src/composables/useNavigation.ts`

Reactive composable for navigation functionality.

```typescript
function useNavigation() {
  return {
    // Reactive properties
    currentPage: ComputedRef<PageType>;
    isNavigating: ComputedRef<boolean>;
    isValidating: ComputedRef<boolean>;
    validationError: ComputedRef<ValidationError | null>;

    // Methods
    navigateTo: (page: PageType, isBack?: boolean) => Promise<boolean>;
    setNavigationGuard: (guard: NavigationGuard | null) => void;
  };
}
```

**Usage**:

```typescript
import { useNavigation } from "@/composables/useNavigation";

const navigation = useNavigation();

// Navigate to settings
await navigation.navigateTo("settings");

// Check current page
const currentPage = navigation.currentPage.value;

// Register navigation guard
navigation.setNavigationGuard(async (target, direction) => {
  if (target === "settings" && direction === "back") {
    // Validate before navigating away
    const isValid = await validateSettings();
    return {
      allowed: isValid,
      error: isValid
        ? undefined
        : {
            message: "Settings validation failed",
            code: "VALIDATION_ERROR",
          },
    };
  }
  return { allowed: true };
});
```

### usePageLoading Composable

**Location**: `webview-ui/src/composables/usePageLoading.ts`

Composable to determine loading state for a specific page.

```typescript
interface PageLoadingState {
  showNavigationLoading: ComputedRef<boolean>;
  showPageLoading: ComputedRef<boolean>;
}

function usePageLoading(page: PageType, pageLoadingContext: LoadingContext): PageLoadingState;
```

**Usage**:

```typescript
import { usePageLoading } from "@/composables/usePageLoading";

const pageLoading = usePageLoading("wiki", "wiki");

// Navigation loading: true when navigating TO this page
const isNavigating = pageLoading.showNavigationLoading.value;

// Page loading: true when ON this page and page context is active
const isPageLoading = pageLoading.showPageLoading.value;
```

**Logic**:

- `showNavigationLoading`: Returns `true` only when navigating TO the specified page
- `showPageLoading`: Returns `true` only when ON the specified page and the page's loading context is active
- The two states are mutually exclusive

### Navigation Guard Pattern

Navigation guards are pure validation functions:

```typescript
// Example: Settings navigation guard
function createSettingsNavigationGuard(
  settings: ReturnType<typeof useSettingsStore>,
  wiki: ReturnType<typeof useWikiStore>,
  providerConfigs: Ref<ProviderConfig[]>,
): NavigationGuard {
  return async (target: PageType, direction: "forward" | "back"): Promise<ValidationResult> => {
    // Only validate when navigating away from settings
    if (direction === "back" && target !== "settings") {
      const isValid = await validateSettings(settings, wiki, providerConfigs);
      if (!isValid) {
        return {
          allowed: false,
          error: {
            message: "Settings validation failed",
            code: "VALIDATION_ERROR",
            suggestions: ["Fix validation errors"],
          },
        };
      }
    }

    return { allowed: true };
  };
}

// Register guard
const navigation = useNavigation();
navigation.setNavigationGuard(createSettingsNavigationGuard(settings, wiki, providerConfigs));
```

**Key Points**:

- Guards are pure functions with no side effects
- Return structured validation results
- Do not manage loading contexts or UI state
- Error display is handled by pages, not guards

## Error System API

### Centralized Error Store

**Location**: `webview-ui/src/stores/error.ts`

Single source of truth for error state with lifecycle management and navigation integration.

```typescript
interface ErrorState {
  id: string;
  message: string;
  code?: string;
  category?: string;
  suggestions?: string[];
  retryable?: boolean;
  retryAction?: () => void;
  actions?: ErrorAction[];
  timestamp: string;
  context: ErrorContext;
  originalError?: string;
  severity: "info" | "warning" | "error" | "critical";
}

interface ErrorContext {
  page: PageType;
  component?: string;
  operation?: string;
}

interface ErrorAction {
  label: string;
  type: "navigate" | "retry" | "custom" | "dismiss";
  target?: PageType | string;
  handler?: () => void;
  condition?: (currentPage: PageType) => boolean;
}

interface ErrorStoreState {
  currentError: ErrorState | null;
  dismissedErrorIds: Set<string>;
  errorContext: ErrorContext | null;
  isModalOpen: boolean;
}
```

**Actions**:

```typescript
// Set a new error
setError(error: Partial<ErrorState>): void

// Dismiss error (user explicitly closed it)
dismissError(errorId: string): void

// Clear error (programmatic, e.g., on navigation)
clearError(): void

// Clear all errors for a specific page
clearPageErrors(page: PageType): void

// Navigation integration
onNavigationStart(targetPage: PageType): void
onNavigationComplete(currentPage: PageType): void

// Context management
setContext(context: ErrorContext): void
clearContext(): void

// Error actions
executeAction(action: ErrorAction): void
retryLastOperation(): void
```

**Getters**:

```typescript
// Current active error
currentError: ComputedRef<ErrorState | null>;

// Is modal open?
isModalOpen: ComputedRef<boolean>;

// Current error context
errorContext: ComputedRef<ErrorContext | null>;
```

### useError Composable

**Location**: `webview-ui/src/composables/useError.ts`

Convenience methods for components to report errors with automatic context injection.

```typescript
function useError() {
  return {
    // Show a simple error
    showError(error: Partial<ErrorState>): void;

    // Show retryable error with retry action
    showRetryableError(
      message: string,
      retryAction: () => void,
      options?: Partial<ErrorState>
    ): void;

    // Show configuration error with navigation to settings
    showConfigurationError(
      message: string,
      code?: string,
      options?: Partial<ErrorState>
    ): void;

    // Clear current error
    clearError(): void;
  };
}
```

**Usage**:

```typescript
import { useError } from "@/composables/useError";

const { showError, showRetryableError } = useError();

// Simple error
showError({
  message: "Operation failed",
  code: "OPERATION_FAILED",
  suggestions: ["Check your connection"],
});

// Retryable error
showRetryableError("Network request failed", () => retryOperation(), { code: "NETWORK_ERROR" });
```

### GlobalErrorModal Component

**Location**: `webview-ui/src/components/GlobalErrorModal.vue`

Single error modal instance in App.vue that displays errors from the centralized error store.

**Features**:

- Automatically displays current active error
- Shows error message, suggestions, and action buttons
- Handles error dismissal
- Executes error actions (retry, navigate, custom)
- Conditional action visibility based on current page

**Integration**:

The GlobalErrorModal is added once to App.vue and watches the centralized error store for active errors. No page-specific error modals are needed.

## Logging Infrastructure

### Log Modes

Qwiki supports two logging modes. The extension starts in `normal` mode unless the environment variable `LOG_MODE=verbose` is present.

- **"normal"** (default): Logs warnings and errors
- **"verbose"**: Logs debug, info, warn, and error levels

### Toggle Logging Mode

Use the command palette command **"Qwiki: Toggle Logging Mode"** to switch between the two modes:

- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
- Type "Qwiki: Toggle Logging Mode"
- The mode toggles: Normal ↔ Verbose
- A notification shows the current active mode

### Backend (Extension Host)

```typescript
// src/infrastructure/services/LoggingService.ts
type LogLevel = "debug" | "info" | "warn" | "error";
type LogMode = "normal" | "verbose";

export interface LoggerConfig {
  mode: LogMode;
  includeTimestamp: boolean;
  includeService: boolean;
}

export class LoggingService {
  private static instance: LoggingService;

  static getInstance(): LoggingService;
  static setInstance(instance: LoggingService): void;

  constructor(config: LoggerConfig);
  setMode(mode: LogMode): void;
  getMode(): LogMode;

  debug(service: string, message: string, data?: unknown): void;
  info(service: string, message: string, data?: unknown): void;
  warn(service: string, message: string, data?: unknown): void;
  error(service: string, message: string, data?: unknown): void;
}

export function createLogger(serviceName: string): Logger;
```

**Key Features**:

- Singleton pattern - single instance across the application
- Registered once via `registerInfrastructureServices()` in `src/application/bootstrap/registrations/InfrastructureServiceRegistrations.ts` (`loggingService` key)
- Injected into services/commands/events via DI container
- Default config: `{ mode: "normal", includeTimestamp: true, includeService: true }` (set to `"verbose"` automatically when `LOG_MODE=verbose`)
- Mode can be changed at runtime via `setMode()` or command palette
- Log levels filtered based on mode:
  - `"normal"`: Only `warn` and `error`
  - `"verbose"`: All levels (`debug`, `info`, `warn`, `error`)

### Frontend (Webview)

```typescript
// webview-ui/src/utilities/logging.ts
type LogLevel = "debug" | "info" | "warn" | "error";
type LogMode = "normal" | "verbose";

export interface FrontendLoggerConfig {
  mode: LogMode;
  includeTimestamp: boolean;
  includeSource: boolean;
}

export class FrontendLoggingService {
  private static instance: FrontendLoggingService;

  static getInstance(): FrontendLoggingService;
  static setInstance(instance: FrontendLoggingService): void;

  setMode(mode: LogMode): void;
  getMode(): LogMode;
}

export function createLogger(source: string): Logger;

export type Logger = {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
};
```

**Key Features**:

- Mirrors backend behavior (mode-based filtering, metadata formatting)
- Default config: `{ mode: "normal", includeTimestamp: true, includeSource: true }`
- Mode synchronized with backend when changed via command palette
- Intended to replace all raw `console.*` usage inside `webview-ui`
- Forward logs to the extension by combining with `vscode.postMessage({ command: "frontendLog", ... })` when central aggregation is needed
