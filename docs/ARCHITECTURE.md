# Qwiki VS Code Extension Architecture

## Overview

The Qwiki VS Code extension follows a clean, modular architecture based on SOLID principles and design patterns. The architecture is organized into distinct layers with clear separation of concerns, making the codebase maintainable and extensible.

## Architecture Layers

### 1. Domain Layer

The domain layer contains the core business entities and repository interfaces that define the business model.

**Location:** `src/domain/`

**Components:**

- **Entities** (`src/domain/entities/`)
  - `Wiki.ts`: Represents a wiki document with its properties
  - `Selection.ts`: Represents text selection in the editor
- **Repository Interfaces** (`src/domain/repositories/`)
  - `ApiKeyRepository.ts`: Interface for API key storage operations
  - `ConfigurationRepository.ts`: Interface for configuration management

**Purpose:**

- Define core business entities
- Establish contracts for data access
- Contain business logic that is independent of external frameworks

### 2. Application Layer

The application layer contains services, commands, and application-specific business logic.

**Location:** `src/application/`

**Components:**

- **Services** (`src/application/services/`)

  **Core Services**:
  - `WikiService.ts`: Core wiki generation logic with loading steps
  - `CachedWikiService.ts`: Cached wiki generation with performance optimization
  - `SelectionService.ts`: Editor selection handling
  - `ProjectContextService.ts`: Project context building with file discovery
  - `CachedProjectContextService.ts`: Cached project context for performance
  - `MessageBusService.ts`: Webview communication with batching/debouncing
  - `WikiStorageService.ts`: Wiki persistence to `.qwiki` folder
  - `WikiSummarizationService.ts`: Summarize wikis for README generation

  **Configuration Services**:
  - `ConfigurationManagerService.ts`: Centralized configuration management
  - `ConfigurationValidationEngineService.ts`: Rule-based validation engine
  - `ConfigurationTemplateService.ts`: Configuration templates and presets
  - `ConfigurationImportExportService.ts`: Configuration backup/restore
  - `ConfigurationMigrationService.ts`: Version migration support

  **Context Intelligence Services**:
  - `ContextIntelligenceService.ts`: Orchestrates optimal context selection with token budget management
  - `ContextAnalysisService.ts`: Deep code analysis orchestrator
    - `context/PatternExtractionService.ts`: Pattern extraction (functions, classes, interfaces)
    - `context/StructureAnalysisService.ts`: Code structure analysis (parameters, visibility, decorators)
    - `context/RelationshipAnalysisService.ts`: Code relationship analysis (calls, inheritance, dependencies)
    - `context/ComplexityCalculationService.ts`: Complexity metrics calculation
    - `context/FileRelevanceAnalysisService.ts`: Ranks files by relevance to target file
    - `context/FileRelevanceBatchService.ts`: Batch relevance scoring for performance
    - `context/FileSelectionService.ts`: Selects optimal files within token budget
    - `context/DependencyAnalysisService.ts`: Analyzes project dependencies
    - `context/TextUsageSearchService.ts`: Searches for symbol usage across files
    - `context/ProjectTypeDetectionService.ts`: Detects project type and framework
    - `context/ProjectOverviewService.ts`: Generates project summaries
    - `context/CodeExtractionService.ts`: Extracts code samples with context
  - `ContextCompressionService.ts`: Compresses context to fit token budgets

  **Prompt Engineering Services**:
  - `AdvancedPromptService.ts`: Advanced prompt construction and optimization
  - `PromptQualityService.ts`: Prompt quality analysis and scoring
  - `prompt/PromptSectionBuilder.ts`: Builds structured prompt sections
  - `prompt/PromptQualityAnalyzer.ts`: Analyzes prompt effectiveness
  - `prompt/AdaptivePromptHelpers.ts`: Provider-specific prompt adaptation

  **README Automation Services**:
  - `ReadmeUpdateService.ts`: Orchestrates README updates with approval workflow
  - `ReadmeFileService.ts`: README file I/O operations
  - `ReadmeBackupService.ts`: Backup and restore README files
  - `ReadmeDiffService.ts`: Generate diffs for README changes
  - `ReadmeCacheService.ts`: Cache README operations
  - `ReadmeChunkedUpdateService.ts`: Chunked writes for large READMEs
  - `ReadmeStateDetectionService.ts`: Detects README state (boilerplate, custom, etc.)
  - `ReadmeContentAnalysisService.ts`: Analyzes README content structure
  - `ReadmePromptBuilderService.ts`: Builds prompts for README generation
  - `ReadmePromptOptimizationService.ts`: Optimizes README prompts
  - `readme/ReadmeParser.ts`: Parses README structure
  - `readme/ReadmeSectionGenerator.ts`: Generates README sections

  **Provider Services**:
  - `SmartProviderSelectionService.ts`: Intelligent provider selection based on context
  - `ProviderSelectionService.ts`: Provider capability matching
  - `ProviderFallbackManagerService.ts`: Automatic fallback and retry logic
  - `ProviderDiscoveryService.ts`: Dynamic provider discovery
  - `ProviderLifecycleManagerService.ts`: Provider initialization and lifecycle
  - `ProviderDependencyResolverService.ts`: Provider dependency resolution

  **Performance Services**:
  - `ProviderPerformanceService.ts`: Performance monitoring orchestrator
    - `performance/MetricsCollectionService.ts`: Metrics collection and management
    - `performance/StatisticsCalculationService.ts`: Performance statistics and rankings
    - `performance/PerformanceMonitoringService.ts`: Performance monitoring and reporting

  **Data Transformation**:
  - `transformers/WikiTransformer.ts`: Pure data transformation functions for wiki generation

  **Validation**:
  - `validation/ProviderValidationRules.ts`: Provider configuration validation rules

  **Aggregation Helpers**:
  - `aggregation/ConflictResolutionHelper.ts`: Resolves conflicts in aggregated content
  - `aggregation/StructureOptimizer.ts`: Optimizes aggregated structure

- **Commands** (`src/application/commands/`)

  **Current Commands**:
  - `Command.ts`: Base command interface
  - `GenerateWikiCommand.ts`: Wiki generation command with context intelligence
  - `GetSelectionCommand.ts`: Get editor selection
  - `GetRelatedCommand.ts`: Get related files for context
  - `SelectProviderCommand.ts`: Select provider for generation

  **Provider Management Commands**:
  - `SaveApiKeyCommand.ts`: Save provider API key securely
  - `DeleteApiKeyCommand.ts`: Delete API key
  - `GetApiKeysCommand.ts`: List saved API keys
  - `GetProvidersCommand.ts`: List available providers
  - `GetProviderConfigsCommand.ts`: Get provider configurations
  - `GetProviderCapabilitiesCommand.ts`: Get provider capabilities
  - `GetProviderHealthCommand.ts`: Check provider health status
  - `GetProviderPerformanceCommand.ts`: Get provider performance metrics

  **Configuration Commands**:
  - `GetConfigurationCommand.ts`: Get current configuration
  - `UpdateConfigurationCommand.ts`: Update configuration
  - `ValidateConfigurationCommand.ts`: Validate configuration
  - `ApplyConfigurationTemplateCommand.ts`: Apply configuration template
  - `GetConfigurationTemplatesCommand.ts`: List available templates
  - `CreateConfigurationBackupCommand.ts`: Backup configuration
  - `GetConfigurationBackupsCommand.ts`: List configuration backups

  **Wiki Storage Commands**:
  - `SaveWikiCommand.ts`: Save generated wiki
  - `DeleteWikiCommand.ts`: Delete saved wiki
  - `GetSavedWikisCommand.ts`: List all saved wikis

  **README Automation Commands**:
  - `UpdateReadmeCommand.ts`: Update README from wikis
  - `ApproveReadmeUpdateCommand.ts`: Approve pending README update
  - `CancelReadmeUpdateCommand.ts`: Cancel pending README update
  - `UndoReadmeCommand.ts`: Undo last README update
  - `CheckReadmeBackupCommand.ts`: Check README backup state

  **Utility Commands**:
  - `OpenFileCommand.ts`: Open file in editor
  - `OpenExternalCommand.ts`: Open external links
  - `SaveSettingCommand.ts`: Save extension settings

- **CommandRegistry.ts**: Registry for managing commands
- `AppBootstrap.ts`: Application bootstrap and dependency injection setup

**Purpose:**

- Implement application-specific business logic
- Coordinate between domain and infrastructure layers
- Handle user interactions through commands

### Advanced Capabilities

The application layer includes coordinated subsystems:

- **Prompt Engineering** – Template lifecycle, validation, provider variants, dynamic adjustments, and library management work together to deliver resilient prompts across providers.
- **Output Consistency** – Validation, normalization, consistency scoring, caching, and fallback services ensure generated documentation is reliable and recoverable.
- **Wiki Aggregation** – Storage, aggregation, linking, indexing, search, and versioning combine to build comprehensive project documentation maps.
- **Quality Assurance** – Metrics, improvement planning, and QA workflow services provide continuous insight and gated approval flows for documentation updates.

Each subsystem is registered in `AppBootstrap` so commands and webviews can resolve dependencies through the container.

### 3. Infrastructure Layer

The infrastructure layer contains implementations of domain interfaces and external service integrations.

**Location:** `src/infrastructure/`

**Components:**

- **Repositories** (`src/infrastructure/repositories/`)
  - `VSCodeApiKeyRepository.ts`: VS Code secret storage implementation
  - `VSCodeConfigurationRepository.ts`: VS Code settings implementation
- **Services** (`src/infrastructure/services/`)

  **Error Handling Services**:
  - `ErrorHandler.ts`: Global error handler
  - `ErrorLoggingService.ts`: Error logging and user feedback
  - `ErrorRecoveryService.ts`: Error recovery mechanisms

  **Logging & Monitoring Services**:
  - `LoggingService.ts`: Structured logging service (replaces console.log)
  - `LogSanitizer.ts`: Sanitizes sensitive data from logs
  - `PerformanceMonitorService.ts`: Performance monitoring and metrics collection
  - `PerformanceMonitor.ts`: Performance tracking and measurement

  **Caching & Optimization Services**:
  - `CachingService.ts`: Generic caching service with TTL support
  - `GenerationCacheService.ts`: Generation result caching
  - `RequestBatchingService.ts`: Request batching for performance
  - `DebouncingService.ts`: Function debouncing service
  - `BackgroundProcessingService.ts`: Background task processing
  - `MemoryOptimizationService.ts`: Memory usage optimization
  - `WebviewOptimizerService.ts`: Webview message batching and debouncing

  **Project Context & Indexing Services**:
  - `ProjectIndexService.ts`: Builds and maintains project file index
  - `ProjectContextCacheService.ts`: Caches project context data
  - `ProjectContextValidationService.ts`: Validates project context entries
  - `ProjectContextCacheInvalidationService.ts`: Manages cache invalidation
  - `WorkspaceStructureCacheService.ts`: Caches workspace structure analysis
  - `indexing/FileMetadataExtractionService.ts`: Extracts file metadata for indexing
  - `indexing/IndexCacheService.ts`: Manages index cache
  - `workspace-cache/FileLevelCacheHandler.ts`: File-level cache operations
  - `workspace-cache/WorkspaceLevelCacheHandler.ts`: Workspace-level cache operations

  **Provider Services**:
  - `ProviderFileSystemService.ts`: Provider file system operations
  - `ProviderHealthService.ts`: Provider health monitoring
  - `ProviderValidationService.ts`: Provider configuration validation
  - `ProviderPerformanceService.ts`: Performance monitoring orchestrator
    - `performance/MetricsCollectionService.ts`: Metrics collection
    - `performance/StatisticsCalculationService.ts`: Statistics calculation
    - `performance/PerformanceMonitoringService.ts`: Performance monitoring

  **File System & Storage Services**:
  - `VSCodeFileSystemService.ts`: VS Code file system API wrapper
  - `ConfigurationBackupService.ts`: Configuration backup and restore
  - `ExtensionContextStorageService.ts`: Extension context storage
  - `WikiWatcherService.ts`: Watches wiki files for changes

  **Integration Services**:
  - `LanguageServerIntegrationService.ts`: Integrates with VS Code language servers
  - `GitChangeDetectionService.ts`: Detects git changes in workspace

**Purpose:**

- Implement domain interfaces
- Handle external system integrations
- Provide technical capabilities like caching and error handling

### 4. Presentation Layer

The presentation layer handles user interface, user interactions, and VS Code IDE integration.

**Location:** `src/panels/`, `src/providers/`, `src/views/`, and `webview-ui/`

**Components:**

- **Webview Panels** (`src/panels/`)
  - `QwikiPanel.ts`: Main webview panel orchestrator
  - `webviewContent.ts`: Webview HTML content generation
  - `WebviewMessageHandler.ts`: Handles messages between webview and extension
  - `NavigationManager.ts`: Manages webview navigation state
  - `EnvironmentStatusManager.ts`: Monitors and reports environment health
  - `LanguageStatusMonitor.ts`: Monitors language server status
  - `constants.ts`: Panel-specific constants
  - `fileOps.ts`: File operations for panels

- **VS Code Language Features** (`src/providers/`)
  - `DocumentationHoverProvider.ts`: Hover information for code
  - `DocumentationCompletionProvider.ts`: Code completion suggestions
  - `DocumentationCodeActionProvider.ts`: Quick fixes and refactorings
  - `DocumentationDiagnosticsProvider.ts`: Diagnostic messages and warnings
  - `DocumentSymbolProvider.ts`: Document outline and symbols
  - `WorkspaceSymbolProvider.ts`: Workspace-wide symbol search
  - `WikiContentProvider.ts`: Virtual wiki content provider
  - `WikiCustomEditorProvider.ts`: Custom editor for wiki files
  - `WikiDocumentLinkProvider.ts`: Clickable links in wiki files

- **Views** (`src/views/`)
  - `SavedWikisTreeView.ts`: Tree view for browsing saved wikis

- **Webview UI** (`webview-ui/`)
  - **App.vue**: Top-level navigation and loading orchestration
  - **Components** (`components/`):
    - `layout/`: TopBar and layout components
    - `pages/`: HomePage, WikiPage, SettingsPage, SavedWikisPage, ErrorHistoryPage
    - `features/`: LoadingState, ErrorModal, ErrorDisplay, ValidationErrors, ReadmeDiffView, WikiListItem, etc.
    - `ui/`: Button, Card, Modal components (shadcn-vue style)
  - **Stores** (`stores/`):
    - `wiki.ts`: Wiki generation state
    - `settings.ts`: Settings and configuration state
    - `environment.ts`: Environment health monitoring
    - `navigationStatus.ts`: Navigation state
    - `errorHistory.ts`: Error tracking
    - `loading.ts`: Centralized loading state management
  - **Composables** (`composables/`):
    - `useNavigation.ts`: Navigation helpers
    - `useBatchMessageBridge.ts`: Message batching
    - `useVscodeMessaging.ts`: VS Code message bridge
    - `useSettingsHandlers.ts`: Settings event handlers
    - `useProviderConfigs.ts`: Provider configuration helpers
  - **Loading System** (`loading/`):
    - `loadingBus.ts`: Loading event bus
    - `stepCatalog.ts`: Centralized loading step definitions
    - `useLoading.ts`: Loading state composable
    - `types.ts`: Loading system types
    - `config.ts`: Loading configuration

**Purpose:**

- Display user interface (webview)
- Provide VS Code IDE integration (language features, tree views)
- Handle user interactions
- Communicate with application layer
- Monitor environment health
- Manage navigation and loading states

## Key Architectural Features

### Context Intelligence Pipeline

The Context Intelligence Pipeline is a sophisticated system that optimizes context selection for LLM requests:

**Components**:

- **ContextIntelligenceService**: Orchestrates the entire pipeline
- **ProjectIndexService**: Maintains fast-access index of project files
- **FileRelevanceAnalysisService**: Ranks files by relevance to target
- **FileRelevanceBatchService**: Batch-processes relevance scoring for performance
- **FileSelectionService**: Selects optimal files within token budget
- **ContextCompressionService**: Compresses context to fit provider limits

**Workflow**:

1. **Index Building**: Project files are indexed with metadata extraction
2. **Relevance Ranking**: Files ranked by dependencies, imports, and symbol usage
3. **Token Budget Calculation**: Provider capabilities determine available tokens
4. **Optimal Selection**: Files selected to maximize relevance within budget
5. **Context Compression**: Selected context compressed if needed
6. **Provider-Specific Adaptation**: Context tailored for specific provider

**Performance Optimizations**:

- Batch relevance scoring (O(n) instead of O(n²))
- Workspace structure caching
- File-level and workspace-level cache handlers
- Incremental index updates via Git change detection

### README Automation Workflow

Automated README updates with approval flow and rollback support:

**Components**:

- **ReadmeUpdateService**: Orchestrates the update workflow
- **ReadmeStateDetectionService**: Analyzes README state (boilerplate, custom, etc.)
- **ReadmeContentAnalysisService**: Parses README structure
- **ReadmePromptBuilderService**: Builds prompts for section generation
- **ReadmeDiffService**: Generates diffs for preview
- **ReadmeBackupService**: Manages backups and rollback
- **ReadmeChunkedUpdateService**: Handles large READMEs with chunked writes
- **WikiSummarizationService**: Summarizes wikis for README content

**Workflow**:

1. **Analyze**: Detect README state and parse existing structure
2. **Generate**: Use saved wikis to generate candidate sections
3. **Preview**: Display diff to user with approval UI
4. **Backup**: Create automatic backup before writing
5. **Update**: Write changes in chunks with progress events
6. **Rollback**: Support undo to previous state

**Events**:

- `readmeUpdateProgress`: Progress updates during generation
- `readmeBackupCreated`: Backup completion notification
- `readmeUpdateApproved`: User approval received
- `readmeDiffGenerated`: Diff ready for preview

### Loading System Architecture

Centralized loading state management with context-specific configurations:

**Components**:

- **Loading Store** (`webview-ui/src/stores/loading.ts`): Central state management
- **Loading Bus** (`webview-ui/src/loading/loadingBus.ts`): Message-based communication
- **Step Catalog** (`webview-ui/src/loading/stepCatalog.ts`): Canonical step definitions
- **useLoading Composable**: Easy integration in components

**Features**:

- Per-context timeout management
- Automatic timeout handling
- Progressive loading steps with percentage tracking
- Cancellation support
- Error state handling

**Loading Contexts**:

- `wiki`: Wiki generation (10s timeout, medium density)
- `settings`: Settings initialization (5s timeout, low density)
- `navigation`: Page navigation (5s timeout, low density)
- `environment`: Service readiness (8s timeout, low density)
- `savedWikis`: Wiki collection loading (8s timeout, low density)
- `errorHistory`: Error gathering (5s timeout, low density)

### Environment Monitoring

Real-time environment health tracking:

**Components**:

- **EnvironmentStatusManager** (`src/panels/EnvironmentStatusManager.ts`): Monitors system health
- **LanguageStatusMonitor** (`src/panels/LanguageStatusMonitor.ts`): Tracks language server status
- **Environment Store** (`webview-ui/src/stores/environment.ts`): Frontend state

**Monitored Metrics**:

- Language server readiness
- Background task saturation
- Provider health status
- Memory usage
- Cache performance

**Usage**: The webview displays warnings if environment is not ready before wiki generation.

## Design Patterns

### 1. Command Pattern

All user actions are implemented as commands that implement the `Command` interface:

```typescript
interface Command {
  execute(...args: any[]): Promise<any>;
}
```

Commands are registered in the `CommandRegistry` and executed by name, providing:

- Consistent execution model
- Easy implementation of individual actions
- Extensibility for new commands

### 2. Repository Pattern

Data access is abstracted through repository interfaces:

```typescript
interface ApiKeyRepository {
  save(provider: string, apiKey: string): Promise<void>;
  get(provider: string): Promise<string | undefined>;
  delete(provider: string): Promise<void>;
  list(): Promise<string[]>;
}
```

Benefits:

- Swappable implementations
- Clear separation of data access logic
- Easy implementation through mocking

### 3. Provider Registry (Current Implementation)

Object creation uses a provider registry with static instantiation:

- **Providers Registry** (`src/llm/providers/registry.ts`): The single place that imports and registers all LLM providers. Uses hardcoded instantiation.
- **LLMRegistry** (`src/llm/index.ts`): Loads providers from the registry and exposes generic operations (list, configs, generate) without provider knowledge.
- **CommandFactory**: Creates command instances with lazy loading

**Current Implementation**:

- **Enhanced Registry with Dynamic Discovery**: Providers can be discovered automatically
- **Provider Lifecycle Management**: Proper initialization, disposal, and health monitoring
- **Dependency Resolution**: Automatic resolution of provider dependencies
- **Capability-Based Selection**: Smart provider selection based on code context
- **Fallback Mechanisms**: Automatic fallback when providers fail

**Currently Supported Providers**:

- Google AI Studio (`google-ai-studio`)
- Z.ai (`zai`)
- OpenRouter (`openrouter`)
- Cohere (`cohere`)
- HuggingFace (`huggingface`)

**Recent Improvements**:

- ✅ **Context Intelligence Pipeline**: Sophisticated context optimization with relevance ranking and token budget management
- ✅ **README Automation**: Complete workflow with analysis, generation, preview, approval, backup, and rollback
- ✅ **VS Code Language Features**: Hover, completions, diagnostics, code actions, document symbols, and custom editors
- ✅ **Project Indexing**: Fast file index with metadata extraction and incremental updates
- ✅ **Structured Logging**: All logging through LoggingService with log sanitization
- ✅ **Orchestrator Pattern**: Services use focused sub-services for separation of concerns
  - ContextIntelligenceService orchestrates file relevance, selection, and compression
  - ContextAnalysisService orchestrates pattern, structure, relationship, and complexity analysis
  - ProviderPerformanceService orchestrates metrics, statistics, and monitoring
  - ReadmeUpdateService orchestrates state detection, content analysis, prompting, diffing, and backup
- ✅ **Loading System**: Centralized loading state with context-specific configurations and step catalog
- ✅ **Environment Monitoring**: Real-time health tracking for language servers, providers, and background tasks
- ✅ **Caching Infrastructure**: Multi-level caching (generation, project context, workspace structure, file metadata)
- ✅ **Provider Validation**: Pre-generation validation with actionable warnings
- ✅ **Prompt Engineering**: Advanced prompt services with quality analysis and provider-specific adaptation
- ✅ **Separation of Concerns**: Data transformation extracted to WikiTransformer
- ✅ **Validation Consolidation**: ConfigurationValidationEngineService provides rule-based validation
- ✅ **Constants Management**: Hardcoded values extracted to ServiceLimits and loading step catalog
- ✅ **Code Organization**: All files maintainable size (< 300 lines)
- ✅ **Clean Architecture**: All services properly registered and utilized

**Future Vision: Plugin Architecture**:

- Dynamic provider discovery and registration
- Providers register themselves instead of being registered
- Runtime capability discovery
- True plugin system for extensibility

Benefits:

- Centralized creation logic
- Consistent object initialization
- Easier maintenance of creation logic
- **Future**: Extensible without core code changes

### 4. Dependency Injection

Services are injected through a DI container:

```typescript
class Container {
  register<T>(key: string, factory: () => T): void;
  get<T>(key: string): T;
}
```

Benefits:

- Loose coupling between components
- Easier implementation through dependency mocking
- Centralized dependency management

### 5. Event-Driven Architecture

Services communicate through events for loose coupling:

```typescript
interface EventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}
```

Benefits:

- Reduced coupling between services
- Better scalability
- Easier to add new event handlers

## Recommended Architecture: Hybrid Plugin-Registry

### Core Philosophy

Qwiki uses a **Hybrid Plugin-Registry architecture** that balances extensibility with VS Code extension constraints:

- **Current**: Enhanced Registry with capability-based provider selection
- **Evolution**: Gradual migration to full plugin system
- **Focus**: Documentation generation optimized for VS Code integration

### Provider System Architecture

```typescript
// Enhanced Registry with dynamic discovery and lifecycle management
interface ProviderRegistry {
  registerProvider(id: string, provider: LLMProvider): void;
  discoverProviders(): Promise<ProviderMetadata[]>;
  getProvidersForCapability(capability: ProviderCapability): LLMProvider[];
  reloadProviders(): Promise<void>;
  addProviderDirectory(directoryPath: string): Promise<void>;
  getProviderMetadata(providerId: string): ProviderMetadata | null;
}

// Enhanced provider interface with metadata support
interface LLMProvider {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
  metadata?: ProviderMetadata;

  generate(params: GenerateParams, apiKey?: string): Promise<GenerateResult>;
  supportsCapability(capability: ProviderCapability): boolean;
  getUiConfig(): ProviderUiConfig;
  validateConfig(config: ProviderConfig): ValidationResult;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  healthCheck?(): Promise<HealthCheckResult>;
}

// Provider metadata for discovery system
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
```

### Domain Architecture: Enhanced Clean Architecture

```
src/
├── domain/                    # Business logic (stable)
│   ├── entities/             # Wiki, Selection, Project
│   ├── services/             # IWikiService, IProviderService
│   └── events/               # Domain events
├── application/              # Use cases (moderately stable)
│   ├── services/             # WikiService, ProviderService
│   ├── commands/             # GenerateWikiCommand
│   ├── transformers/         # Data transformation layer
│   └── handlers/             # Command handlers
├── infrastructure/           # External concerns (volatile)
│   ├── providers/            # LLM providers (plugin system)
│   ├── storage/              # VS Code secrets, settings
│   └── external/             # File system, network
└── presentation/             # UI and VS Code integration
    ├── panels/               # Webview panels
    ├── commands/             # VS Code commands
    └── ui/                   # Vue components
```

### Configuration Architecture

**Centralized Configuration Manager with Validation and Templates**:

```typescript
class ConfigurationManagerService {
  private providers = new Map<string, ProviderConfig>();
  private globalSettings: GlobalConfig;
  private validationEngine: ConfigurationValidationEngineService;
  private templateService: ConfigurationTemplateService;
  private importExportService: ConfigurationImportExportService;

  getProviderConfig(providerId: string): ProviderConfig;
  setProviderConfig(providerId: string, config: ProviderConfig): Promise<void>;
  getProvidersForCapability(capability: ProviderCapability): string[];
  validateConfiguration(): Promise<ValidationResult>;
  migrateConfiguration(fromVersion: string, toVersion: string): Promise<void>;

  // Provider management capabilities
  applyTemplate(templateId: string, variables: Record<string, any>): Promise<void>;
  exportConfiguration(options: ExportOptions): Promise<ConfigurationExport>;
  importConfiguration(data: ConfigurationExport, options: ImportOptions): Promise<void>;
  getAvailableTemplates(): ConfigurationTemplate[];
}

// Configuration validation engine
interface ConfigurationValidationEngineService {
  validateConfiguration(
    config: any,
    schema: ValidationSchema,
    context: ValidationContext,
  ): ValidationResult;
  addValidationRule(rule: ValidationRule): void;
  removeValidationRule(ruleId: string): void;
  getValidationRules(): ValidationRule[];
}

// Configuration template system
interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  metadata: TemplateMetadata;
  variables: TemplateVariable[];
  configuration: any;
}
```

### VS Code Integration Architecture

**Deep Editor Integration**:

```typescript
interface VSCodeIntegration {
  // Context awareness
  getWorkspaceContext(): Promise<WorkspaceContext>;
  getFileContext(filePath: string): Promise<FileContext>;
  getSelectionContext(): Promise<SelectionContext>;

  // Settings synchronization
  syncWithVSCodeSettings(): Promise<void>;

  // Performance optimization
  getCachedResult(params: GenerateParams): Promise<GenerateResult | null>;
  checkRateLimit(providerId: string): Promise<boolean>;
}
```

### Documentation-Optimized Design

**Specialized for Documentation Generation**:

```typescript
interface DocumentationProvider extends LLMProvider {
  generateDocumentation(params: DocumentationParams): Promise<DocumentationResult>;
  optimizeForLanguage(language: string): ProviderConfiguration;
  suggestContext(snippet: string): ContextSuggestion[];
}

interface DocumentationParams extends GenerateParams {
  documentationStyle: "javadoc" | "jsdoc" | "pydoc" | "custom";
  includeExamples: boolean;
  targetAudience: "developers" | "users" | "api";
}
```

### Supported Providers

#### Google AI Studio

- Supports both OpenAI-compatible and native endpoints
- Configurable through VS Code settings
- Requires API key from Google AI Studio

#### Z.ai

- OpenAI-compatible API
- Configurable base URL
- Requires API key

#### OpenRouter

- Multiple model support
- Requires API key
- No additional configuration needed

#### Cohere

- Direct Cohere API integration
- Requires API key
- Multiple model support

#### HuggingFace

- Inference API integration
- Requires API key
- Model selection support

## Data Flow

### Request Flow

1. User interacts with webview
2. Webview sends message to `QwikiPanel`
3. `QwikiPanel` forwards to `CommandRegistry`
4. `CommandRegistry` executes appropriate command
5. Command uses services to perform business logic
6. Services use repositories for data access
7. Repositories interact with VS Code API
8. For LLM operations: Services call LLM providers through the registry
9. Providers handle API communication with respective services

### Response Flow

1. Repositories return data to services
2. Services process and return to commands
3. Commands return response to `CommandRegistry`
4. `CommandRegistry` sends to `MessageBusService`
5. `MessageBusService` sends response to webview
6. Webview updates UI
7. For LLM responses: Generated content is displayed in the webview with proper formatting

## Key Architectural Decisions

### 1. Layered Architecture

Clear separation between layers with dependency direction:

- Presentation → Application → Domain ← Infrastructure

### 2. SOLID Principles

- **Single Responsibility**: Each class has one clear purpose
- **Open/Closed**: Easy to add new commands and providers
- **Liskov Substitution**: Commands can be substituted through registry
- **Interface Segregation**: Repository interfaces are focused
- **Dependency Inversion**: High-level modules depend on abstractions

### 3. Clean Code Principles

- No comments - code should be self-explanatory
- Simple functions with single responsibility
- No hardcoded data mixed with logic
- Consistent naming conventions

### 4. Performance Optimizations

- Lazy loading of services
- Caching mechanisms for expensive operations
- Webview message batching and debouncing
- Performance monitoring and metrics
- **Additional Optimizations**:
  - Intelligent caching with TTL and invalidation
  - Request batching for API calls
  - Background processing queue for large generations
  - Memory optimization and garbage collection
  - Generation result caching
  - Function debouncing service

### 6. Loading System Architecture

The loading system follows a centralized, multi-layered architecture that provides unified loading state management across the entire application.

**Core Components:**

```typescript
// Central loading store with per-context state management
interface LoadingStore {
  start(options: LoadingStartOptions): void;
  advance(options: LoadingAdvanceOptions): void;
  complete(options: LoadingCompleteOptions): void;
  fail(options: LoadingFailOptions): void;
  cancel(options: LoadingCancelOptions): void;
  reset(context: LoadingContext): void;
  getState(context: LoadingContext): LoadingStateSnapshot;
}

// Loading contexts with predefined configurations
type LoadingContext =
  | "wiki"
  | "settings"
  | "navigation"
  | "environment"
  | "savedWikis"
  | "errorHistory";

// Loading state snapshot with full metadata
interface LoadingStateSnapshot {
  active: boolean;
  step: string | null;
  percent: number | null;
  startedAt: number | null;
  timeoutMs: number | null;
  error: string | null;
  cancelled: boolean;
}
```

**Architecture Layers:**

1. **Frontend Components** (`/webview-ui/src/components/features/LoadingState.vue`)
   - Visual loading indicators with animated steps
   - Dynamic skeleton component with progressive blur effects
   - Responsive design with auto-centering active steps

2. **Central Loading Store** (`/webview-ui/src/stores/loading.ts`)
   - Unified state management for all loading contexts
   - Automatic timeout handling with configurable per-context timeouts
   - Per-context state snapshots with full metadata tracking

3. **Loading Bus** (`/webview-ui/src/loading/loadingBus.ts`)
   - Message-based communication bridge between backend and frontend
   - Normalizes `loadingStep` payloads from backend into central store
   - Automatic context inference when missing from messages

4. **Type System** (`/webview-ui/src/loading/types.ts`)
   - Comprehensive TypeScript definitions for loading contexts and states
   - Loading density configurations (low, medium, high)
   - Step definition interfaces and progress tracking types

5. **Configuration System** (`/webview-ui/src/loading/config.ts`)
   - Per-context timeout and density settings
   - Centralized configuration management with helper functions
   - Default configurations optimized for each operation type

6. **Step Catalog** (`/webview-ui/src/loading/stepCatalog.ts`)
   - Canonical step definitions for all contexts
   - Eliminates hardcoded step arrays throughout the codebase
   - Centralized maintenance of step text and ordering

**Integration Patterns:**

```typescript
// Backend service integration with progress callbacks
await this.wikiService.generateWiki(request, projectContext, (step: LoadingStep) => {
  this.eventBus.publish(OutboundEvents.loadingStep, { step });
});

// Frontend component integration via composable
const loadingContext = useLoading("wiki");
const isActive = computed(() => loadingContext.isActive.value);
```

**Visual Design System:**

- **Colors:** VS Code theme integration with CSS custom properties
- **Animations:** Gradient spinners, skeleton shimmer, step transitions
- **Typography:** Adaptive sizing based on step state (completed/active/pending)
- **Layout:** Progressive blur and depth effects for visual hierarchy

**Performance Optimizations:**

- ResizeObserver for responsive viewport measurements
- will-change CSS property for smooth animations
- Debounced generation requests and cached results
- Proper cleanup of observers, timers, and event listeners
- Memory-efficient state management with computed properties

**Error Handling & Timeouts:**

- Automatic timeout handling per context (5s-10s depending on operation)
- Standardized error states with user-friendly messages
- Integration with error history system for troubleshooting
- Proper cleanup and state reset on failures

Benefits:

- **Unified Experience:** Consistent loading behavior across all application areas
- **Developer Friendly:** Simple composable API with automatic context management
- **Performance Optimized:** Efficient state updates and smooth animations
- **Maintainable:** Centralized configuration and step definitions
- **Extensible:** Easy to add new contexts and step patterns

## Error Handling

Error handling is implemented through:

1. **Custom Error Classes**: Specific error types for different domains
2. **Global Error Handler**: Centralized error processing
3. **Error Recovery**: Automatic recovery mechanisms
4. **User Feedback**: Clear error messages to users

## Configuration Management

Configuration is intentionally provider-agnostic:

1. **ConfigurationManagerService**: Thin wrapper around the repository for read/write and caching. No global schema or defaults.
2. **Provider-owned settings**: Each provider returns UI metadata from `getUiConfig()` (e.g., `customFields`) declaring its own keys and defaults.
3. **Generic access**: The providers registry injects a `getSetting(key)` accessor to providers so they can read their own settings without the app knowing about them.

## Local-Only Architecture

Qwiki operates entirely within the user's VS Code IDE. There is no cloud hosting, no external servers, and no data stored outside the user's machine. The extension communicates directly with:

- **User's IDE**: VS Code extension API for all editor integration
- **User's File System**: Local project files and configuration
- **External LLM Providers**: User-configured APIs (OpenAI, Google, etc.) - code is sent to these services for documentation generation

All processing, caching, and state management happens locally within VS Code.

## Design Patterns and Extensibility

The architecture supports extensibility through:

1. **Dependency Injection**: Easy mocking of dependencies
2. **Repository Pattern**: Mock implementations for data access
3. **Command Pattern**: Individual command execution
4. **Event System**: Loose coupling between services

## Benefits of This Architecture

1. **Documentation-First Design**: Every architectural decision prioritizes documentation generation quality and speed
2. **Hybrid Evolution Path**: Gradual migration from Registry to Plugin system without breaking existing functionality
3. **VS Code Native Integration**: Deep integration with VS Code ecosystem while maintaining extension constraints
4. **Capability-Based Selection**: Smart provider selection based on code context and requirements
5. **Performance Optimized**: Intelligent caching, batching, and background processing for fast generation
6. **Enterprise Ready**: Team management, security, and compliance features built from the ground up
7. **Developer Experience**: Simple provider development with clear patterns
8. **Future-Proof**: Architecture supports advanced AI features and emerging capabilities

## Why This Architecture for Qwiki

### **Alignment with Core Purpose**

- **Documentation Generation**: Specialized interfaces and optimization for documentation use cases
- **VS Code Integration**: Deep editor context awareness and seamless workflow integration
- **Multiple Providers**: Flexible system that evolves from static to dynamic provider management

### **Balances Competing Concerns**

- **Extensibility vs Stability**: Gradual evolution preserves reliability while adding capabilities
- **Complexity vs Power**: Sophisticated enough for advanced use cases, simple enough for basic usage
- **Performance vs Features**: Optimized for fast generation while supporting advanced AI features

### **Technical Excellence**

- **Clean Architecture**: Clear separation of concerns with well-defined boundaries
- **Type Safety**: Comprehensive TypeScript usage with strict typing
- **Performance**: Optimized for fast documentation generation and responsiveness
- **Error Handling**: Standardized error management with user-friendly messages

### **Future-Proof Design**

- **Plugin System**: True extensibility without core code modifications
- **AI Evolution**: Architecture supports emerging AI capabilities and models
- **Enterprise Scale**: Designed for team usage and organizational requirements
- **Performance**: Optimized for the next generation of AI models and capabilities

## Future Considerations

### Architecture Evolution Path

The current architecture is designed for **gradual evolution** toward a more sophisticated plugin system while maintaining stability.

### Foundation Stabilization

**Objectives**: Fix current technical debt and establish solid foundations

1. **Error Handling Standardization**
   - Implement `ProviderError` base class for consistent error handling
   - Create standardized error response format across all providers
   - Add error recovery mechanisms and user-friendly error messages

2. **Configuration Architecture Enhancement**
   - Extract configuration logic to dedicated `ConfigurationManagerService`
   - Implement configuration validation and type safety
   - Add configuration migration system for version upgrades

3. **Provider Capability System**
   - Define `ProviderCapabilities` interface for provider features
   - Implement capability-based provider selection
   - Add provider validation and health checks

### Enhanced Registry System

**Objectives**: Add extensibility while maintaining current stability

1. **Dynamic Provider Discovery**
   - Implement provider auto-discovery within extension bundle
   - Add provider lifecycle management (initialize, dispose)
   - Create provider metadata and manifest system

2. **Capability-Based Selection**
   - Implement smart provider selection based on code context
   - Add provider capability matching for optimal results
   - Create provider fallback and retry mechanisms

3. **Advanced Configuration Management**
   - Add provider-specific configuration validation
   - Implement configuration templates and presets
   - Create configuration import/export functionality

4. **Performance Optimization**
   - Implement intelligent caching with TTL and invalidation
   - Add request batching and debouncing for webview
   - Create background processing queue for large generations

### Plugin Architecture Implementation

**Objectives**: True extensibility with hot-swappable providers

1. **Plugin Loading System**
   - Implement dynamic plugin loading and unloading
   - Add plugin sandboxing for security
   - Create plugin dependency management

2. **Provider Marketplace Foundation**
   - Design plugin package format and distribution
   - Implement plugin versioning and compatibility checking
   - Add plugin signing and verification

3. **Advanced Provider Features**
   - Implement streaming response support
   - Add function calling and tool use capabilities
   - Create provider chaining and composition

4. **Enterprise Features**
   - Add team-based configuration management
   - Implement provider usage analytics and monitoring
   - Create advanced security and compliance features

### Advanced AI & Collaboration

**Objectives**: Cutting-edge features and enterprise scalability

1. **Multi-Provider Generation**
   - Implement simultaneous generation from multiple providers
   - Add result comparison and quality scoring
   - Create provider ensemble and voting systems

2. **Context-Aware Intelligence**
   - Implement smart context suggestion algorithms
   - Add project-specific learning and adaptation
   - Create documentation style learning and customization

3. **Collaboration Features**
   - Add shared documentation templates and styles
   - Implement team prompt libraries and best practices
   - Create documentation review and approval workflows

4. **Advanced AI Integration**
   - Add custom model fine-tuning support
   - Implement context-aware provider selection
   - Create documentation quality metrics and improvement suggestions

### Technical Debt Management

**Priority Areas**:

1. **Registry Pattern Evolution**
   - Current: Hardcoded provider instantiation
   - Target: Dynamic plugin discovery with hot-swapping
   - Risk: Core architectural changes required

2. **Error Handling Consistency**
   - Current: Provider-specific error formats
   - Target: Standardized error types with recovery
   - Risk: Breaking changes to existing error handling

3. **Configuration Architecture**
   - Current: Mixed responsibilities and leakage
   - Target: Centralized, validated configuration system
   - Risk: Migration complexity for existing configurations

### Architectural Principles

**Guiding Principles for Evolution**:

1. **Backward Compatibility**: Maintain existing provider compatibility during evolution
2. **Gradual Migration**: Incremental approach to minimize disruption
3. **Performance First**: Optimize for documentation generation speed and reliability
4. **Developer Experience**: Ensure provider development remains simple and well-documented
5. **VS Code Integration**: Deep integration with VS Code ecosystem and conventions
6. **Security First**: Plugin sandboxing and secure configuration management
7. **Enterprise Ready**: Design for team usage and organizational requirements
