# Qwiki VS Code Extension Architecture

## Overview

The Qwiki VS Code extension follows a clean, modular architecture based on SOLID principles and design patterns. The architecture is organized into distinct layers with clear separation of concerns, making the codebase maintainable, testable, and extensible.

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
- Easy testing of individual actions
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

- Testable through mocking
- Swappable implementations
- Clear separation of data access logic

### 3. Factory Pattern

Object creation is centralized in factories:

- `LLMProviderFactory`: Creates LLM provider instances
- `CommandFactory`: Creates command instances with lazy loading

Benefits:

- Centralized creation logic
- Consistent object initialization
- Easier maintenance of creation logic

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
- Easier testing through dependency mocking
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

## Data Flow

### Request Flow

1. User interacts with webview
2. Webview sends message to `QwikiPanel`
3. `QwikiPanel` forwards to `CommandRegistry`
4. `CommandRegistry` executes appropriate command
5. Command uses services to perform business logic
6. Services use repositories for data access
7. Repositories interact with VS Code API

### Response Flow

1. Repositories return data to services
2. Services process and return to commands
3. Commands return response to `CommandRegistry`
4. `CommandRegistry` sends to `MessageBus`
5. `MessageBus` sends response to webview
6. Webview updates UI

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

## Error Handling

Error handling is implemented through:

1. **Custom Error Classes**: Specific error types for different domains
2. **Global Error Handler**: Centralized error processing
3. **Error Recovery**: Automatic recovery mechanisms
4. **User Feedback**: Clear error messages to users

## Configuration Management

Configuration is handled through:

1. **ConfigurationManager**: Centralized configuration management
2. **ConfigurationValidator**: Validates configuration values
3. **ConfigurationMigration**: Handles configuration versioning
4. **ConfigurationSchema**: Defines configuration structure

## Testing Strategy

The architecture supports testing through:

1. **Dependency Injection**: Easy mocking of dependencies
2. **Repository Pattern**: Mock implementations for testing
3. **Command Pattern**: Individual command testing
4. **Event System**: Isolated event handler testing

## Benefits of This Architecture

1. **Maintainability**: Clear separation of concerns
2. **Testability**: Easy to unit test individual components
3. **Extensibility**: Easy to add new features
4. **Readability**: Self-explanatory code without comments
5. **Performance**: Optimized for VS Code extension environment
6. **Reliability**: Comprehensive error handling and recovery

## Future Considerations

1. **Plugin System**: Architecture supports adding plugins
2. **Multi-language Support**: Can be extended for different languages
3. **Cloud Integration**: Can integrate with cloud services
4. **Collaboration Features**: Architecture supports real-time collaboration
