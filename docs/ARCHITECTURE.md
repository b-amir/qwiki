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
  - `WikiService.ts`: Core wiki generation logic
  - `SelectionService.ts`: Editor selection handling
  - `ProjectContextService.ts`: Project context building
  - `MessageBus.ts`: Webview communication
  - `ConfigurationManager.ts`: Configuration management
  - `CachedProjectContextService.ts`: Cached version of project context service
  - `CachedWikiService.ts`: Cached version of wiki service
  - `ProviderDiscoveryService.ts`: Dynamic provider discovery and loading
  - `ProviderLifecycleManager.ts`: Provider lifecycle management
  - `ProviderDependencyResolver.ts`: Provider dependency resolution
  - `ContextAnalysisService.ts`: Code context analysis for provider selection
  - `SmartProviderSelectionService.ts`: Intelligent provider selection
  - `ProviderFallbackManager.ts`: Provider fallback and retry mechanisms
  - `ConfigurationValidationEngine.ts`: Configuration validation rules engine
  - `ConfigurationTemplateService.ts`: Configuration templates and presets
  - `ConfigurationImportExportService.ts`: Configuration import/export functionality
- **Commands** (`src/application/commands/`)
  - `Command.ts`: Base command interface
  - `GenerateWikiCommand.ts`: Wiki generation command
  - `GetSelectionCommand.ts`: Get selection command
  - `GetRelatedCommand.ts`: Get related files command
  - `SaveApiKeyCommand.ts`: Save API key command
  - `GetProvidersCommand.ts`: Get providers command
  - `OpenFileCommand.ts`: Open file command
  - `SaveSettingCommand.ts`: Save setting command
  - `DeleteApiKeyCommand.ts`: Delete API key command
  - `GetApiKeysCommand.ts`: Get API keys command
  - `GetProviderConfigsCommand.ts`: Get provider configurations command
  - `GetConfigurationCommand.ts`: Get configuration command
  - `UpdateConfigurationCommand.ts`: Update configuration command
- **CommandRegistry.ts**: Registry for managing commands
- \*\*AppBootstrap.ts`: Application bootstrap and dependency injection setup

**Purpose:**

- Implement application-specific business logic
- Coordinate between domain and infrastructure layers
- Handle user interactions through commands

### 3. Infrastructure Layer

The infrastructure layer contains implementations of domain interfaces and external service integrations.

**Location:** `src/infrastructure/`

**Components:**

- **Repositories** (`src/infrastructure/repositories/`)
  - `VSCodeApiKeyRepository.ts`: VS Code secret storage implementation
  - `VSCodeConfigurationRepository.ts`: VS Code settings implementation
- **Services** (`src/infrastructure/services/`)
  - `ErrorHandler.ts`: Global error handler
  - `ErrorLoggingService.ts`: Error logging and user feedback
  - `ErrorRecoveryService.ts`: Error recovery mechanisms
  - `CacheService.ts`: Generic caching service with TTL support
  - `WebviewOptimizer.ts`: Webview message batching and debouncing
  - `PerformanceMonitor.ts`: Performance monitoring and metrics collection
  - `ProviderFileSystemService.ts`: Provider file system operations
  - `GenerationCacheService.ts`: Generation result caching
  - `RequestBatchingService.ts`: Request batching for performance
  - `DebouncingService.ts`: Function debouncing service
  - `BackgroundProcessingService.ts`: Background task processing
  - `MemoryOptimizationService.ts`: Memory usage optimization

**Purpose:**

- Implement domain interfaces
- Handle external system integrations
- Provide technical capabilities like caching and error handling

### 4. Presentation Layer

The presentation layer handles user interface and user interactions.

**Location:** `src/panels/` and `webview-ui/`

**Components:**

- `QwikiPanel.ts`: Main webview panel
- `webviewContent.ts`: Webview HTML content
- `constants.ts`: Panel-specific constants
- `contextBuilder.ts`: Context building utilities
- `fileOps.ts`: File operations
- `messages.ts`: Message handling
- Vue.js components in `webview-ui/`

**Purpose:**

- Display user interface
- Handle user interactions
- Communicate with application layer

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

**Current Implementation (Phase 2 Enhanced)**:

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

**Phase 2 Achievements**:

- ✅ Dynamic provider discovery with manifest system
- ✅ Provider lifecycle management with state machine
- ✅ Smart provider selection based on capabilities and context
- ✅ Advanced configuration management with validation and templates
- ✅ Performance optimizations including caching, batching, and background processing

**Future Vision: Plugin Architecture (Phase 3+)**:

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

### Provider System Architecture (Phase 2 Implementation)

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

### Configuration Architecture (Phase 2 Enhanced)

**Centralized Configuration Manager with Validation and Templates**:

```typescript
class ConfigurationManager {
  private providers = new Map<string, ProviderConfig>();
  private globalSettings: GlobalConfig;
  private validationEngine: ConfigurationValidationEngine;
  private templateService: ConfigurationTemplateService;
  private importExportService: ConfigurationImportExportService;

  getProviderConfig(providerId: string): ProviderConfig;
  setProviderConfig(providerId: string, config: ProviderConfig): Promise<void>;
  getProvidersForCapability(capability: ProviderCapability): string[];
  validateConfiguration(): Promise<ValidationResult>;
  migrateConfiguration(fromVersion: string, toVersion: string): Promise<void>;

  // Phase 2 additions
  applyTemplate(templateId: string, variables: Record<string, any>): Promise<void>;
  exportConfiguration(options: ExportOptions): Promise<ConfigurationExport>;
  importConfiguration(data: ConfigurationExport, options: ImportOptions): Promise<void>;
  getAvailableTemplates(): ConfigurationTemplate[];
}

// Configuration validation engine
interface ConfigurationValidationEngine {
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
4. `CommandRegistry` sends to `MessageBus`
5. `MessageBus` sends response to webview
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

### 4. Performance Optimizations (Phase 2 Enhanced)

- Lazy loading of services
- Caching mechanisms for expensive operations
- Webview message batching and debouncing
- Performance monitoring and metrics
- **Phase 2 Additions**:
  - Intelligent caching with TTL and invalidation
  - Request batching for API calls
  - Background processing queue for large generations
  - Memory optimization and garbage collection
  - Generation result caching
  - Function debouncing service

## Error Handling

Error handling is implemented through:

1. **Custom Error Classes**: Specific error types for different domains
2. **Global Error Handler**: Centralized error processing
3. **Error Recovery**: Automatic recovery mechanisms
4. **User Feedback**: Clear error messages to users

## Configuration Management

Configuration is intentionally provider-agnostic:

1. **ConfigurationManager**: Thin wrapper around the repository for read/write and caching. No global schema or defaults.
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

### Phase 1: Foundation Stabilization

**Objectives**: Fix current technical debt and establish solid foundations

1. **Error Handling Standardization**
   - Implement `ProviderError` base class for consistent error handling
   - Create standardized error response format across all providers
   - Add error recovery mechanisms and user-friendly error messages

2. **Configuration Architecture Enhancement**
   - Extract configuration logic to dedicated `ConfigurationManager`
   - Implement configuration validation and type safety
   - Add configuration migration system for version upgrades

3. **Provider Capability System**
   - Define `ProviderCapabilities` interface for provider features
   - Implement capability-based provider selection
   - Add provider validation and health checks

### Phase 2: Enhanced Registry System

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

### Phase 3: Plugin Architecture Implementation

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

### Phase 4: Advanced AI & Collaboration

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
2. **Gradual Migration**: Phase-by-phase approach to minimize disruption
3. **Performance First**: Optimize for documentation generation speed and reliability
4. **Developer Experience**: Ensure provider development remains simple and well-documented
5. **VS Code Integration**: Deep integration with VS Code ecosystem and conventions
6. **Security First**: Plugin sandboxing and secure configuration management
7. **Enterprise Ready**: Design for team usage and organizational requirements
