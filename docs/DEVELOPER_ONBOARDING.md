# Developer Onboarding Guide

## Welcome to Qwiki

This guide will help you get started with developing the Qwiki VS Code extension. Qwiki is a VS Code extension that generates documentation for code using AI models.

## Prerequisites

Before you start, make sure you have:

- Node.js (v18 or higher)
- pnpm package manager
- Visual Studio Code
- Basic knowledge of TypeScript
- Understanding of VS Code extension development

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd qwiki
```

### 2. Install Dependencies

```bash
pnpm run install:all
```

This installs dependencies for both the extension and the webview UI.

### 3. Build the Webview UI

```bash
pnpm run build:webview
```

### 4. Build the Extension

```bash
pnpm run compile
```

### 5. Run in Development Mode

1. Open the project in VS Code
2. Press F5 to launch a new Extension Development Host window
3. In the new window, open a project folder
4. Open the Qwiki panel from the activity bar
5. Configure an LLM provider in the settings to test functionality

## Project Structure

The project follows a clean architecture with clear separation of concerns:

```
qwiki/
├── src/                      # Extension source code
│   ├── extension.ts          # Main extension entry point
│   ├── application/          # Application layer (services, commands)
│   │   ├── services/         # Business logic services
│   │   │   ├── WikiService.ts
│   │   │   ├── SelectionService.ts
│   │   │   ├── ProjectContextService.ts
│   │   │   ├── MessageBus.ts
│   │   │   ├── ConfigurationManager.ts
│   │   │   ├── ConfigurationValidator.ts
│   │   │   ├── ConfigurationMigrationService.ts
│   │   │   ├── ConfigurationTemplateService.ts
│   │   │   ├── ErrorRecoveryService.ts
│   │   │   ├── ErrorLoggingService.ts
│   │   │   ├── ProviderSelectionService.ts
│   │   │   ├── ProviderHealthService.ts
│   │   │   ├── ProviderPerformanceService.ts
│   │   │   ├── [Phase 2 Services]
│   │   │   │   ├── ProviderDiscoveryService.ts
│   │   │   │   ├── ProviderLifecycleManager.ts
│   │   │   │   ├── ProviderDependencyResolver.ts
│   │   │   │   ├── ContextAnalysisService.ts
│   │   │   │   ├── SmartProviderSelectionService.ts
│   │   │   │   ├── ProviderFallbackManager.ts
│   │   │   │   ├── ConfigurationValidationEngine.ts
│   │   │   │   ├── ConfigurationImportExportService.ts
│   │   │   │   └── [Cached services]
│   │   ├── commands/         # Command implementations
│   │   │   ├── GenerateWikiCommand.ts
│   │   │   ├── GetSelectionCommand.ts
│   │   │   ├── SaveApiKeyCommand.ts
│   │   │   └── [Other command files]
│   │   ├── CommandRegistry.ts
│   │   └── AppBootstrap.ts
│   ├── domain/               # Domain layer (entities, repositories)
│   │   ├── entities/         # Business entities
│   │   │   ├── Wiki.ts
│   │   │   └── Selection.ts
│   │   └── repositories/     # Repository interfaces
│   │       ├── ApiKeyRepository.ts
│   │       └── ConfigurationRepository.ts
│   ├── infrastructure/       # Infrastructure layer (implementations)
│   │   ├── repositories/     # VS Code implementations
│   │   │   ├── VSCodeApiKeyRepository.ts
│   │   │   └── VSCodeConfigurationRepository.ts
│   │   └── services/         # Technical services
│   │       ├── ErrorHandler.ts
│   │       ├── CacheService.ts
│   │       ├── PerformanceMonitor.ts
│   │       ├── WebviewOptimizer.ts
│   │       ├── ErrorRecoveryService.ts
│   │       ├── ErrorLoggingService.ts
│   │       ├── ConfigurationBackupService.ts
│   │       ├── ProviderHealthService.ts
│   │       └── ProviderPerformanceService.ts
│   ├── llm/                  # LLM provider system
│   │   ├── providers/        # Individual provider implementations
│   │   │   ├── openai.ts
│   │   │   ├── google-ai-studio.ts
│   │   │   ├── cohere.ts
│   │   │   ├── huggingface.ts
│   │   │   ├── openrouter.ts
│   │   │   ├── zai.ts
│   │   │   └── registry.ts
│   │   ├── types/            # Type definitions (Phase 2 enhanced)
│   │   │   ├── ProviderCapabilities.ts
│   │   │   ├── ProviderMetadata.ts
│   │   │   └── index.ts
│   │   ├── index.ts
│   │   ├── prompt.ts
│   │   ├── provider-config.ts
│   │   └── types.ts
│   ├── panels/               # WebView panel implementations
│   │   ├── QwikiPanel.ts     # Main Qwiki panel
│   │   ├── webviewContent.ts
│   │   ├── constants.ts
│   │   ├── contextBuilder.ts
│   │   ├── fileOps.ts
│   │   └── messages.ts
│   ├── container/            # Dependency injection container
│   │   └── Container.ts
│   ├── constants/            # Application constants
│   │   ├── Commands.ts
│   │   ├── ErrorCodes.ts
│   │   ├── Events.ts
│   │   ├── Extension.ts
│   │   ├── FilePatterns.ts
│   │   ├── MessageConstants.ts
│   │   ├── PathConstants.ts
│   │   └── WebviewConstants.ts
│   ├── errors/               # Custom error classes
│   │   └── BaseError.ts
│   ├── events/               # Event system
│   ├── factories/            # Factory implementations
│   └── utilities/            # Helper functions
├── webview-ui/               # Vue.js webview application
│   ├── src/
│   │   ├── App.vue           # Main Vue component
│   │   ├── components/       # Vue components
│   │   ├── stores/           # Pinia state management
│   │   ├── composables/      # Vue composables
│   │   ├── lib/              # Shared utilities
│   │   └── utilities/        # Helper functions
│   ├── package.json          # Webview dependencies
│   ├── vite.config.ts        # Vite build configuration
│   └── tailwind.config.cjs   # Tailwind CSS configuration
├── docs/                     # Documentation
├── resources/                # Extension resources
└── package.json              # Extension manifest and dependencies
```

## Key Concepts

### 1. Architecture Layers

The extension follows a layered architecture:

- **Domain Layer**: Core business entities and interfaces
- **Application Layer**: Services, commands, and business logic
- **Infrastructure Layer**: External integrations and implementations
- **Presentation Layer**: UI components and webviews

### 2. Dependency Injection

The extension uses a dependency injection container to manage services:

```typescript
// Register a service
container.register("serviceName", () => new Service());

// Get a service
const service = container.get<Service>("serviceName");
```

### 3. Command Pattern

All user actions are implemented as commands:

```typescript
class GenerateWikiCommand implements Command {
  async execute(...args: any[]): Promise<any> {
    // Command implementation
  }
}
```

### 4. Repository Pattern

Data access is abstracted through repositories:

```typescript
interface ApiKeyRepository {
  save(provider: string, apiKey: string): Promise<void>;
  get(provider: string): Promise<string | undefined>;
  delete(provider: string): Promise<void>;
  list(): Promise<string[]>;
}
```

## Development Workflow

### 1. Making Changes

1. Identify the appropriate layer for your changes
2. Follow the existing patterns and conventions
3. Ensure your code follows SOLID principles
4. Test your changes in the development environment

### 2. Adding New Features

1. Define domain entities if needed
2. Create repository interfaces
3. Implement application services
4. Create commands for user interactions
5. Add infrastructure implementations
6. Update UI components if necessary

### 3. Adding New LLM Providers (Phase 2 Enhanced)

**Current Process (Enhanced Registry with Dynamic Discovery)**:

1. Create a provider file under `src/llm/providers/<provider-id>.ts` implementing enhanced `LLMProvider` interface.
2. Create a provider manifest file (`provider.json`) with metadata and capabilities.
3. Place provider files in a discoverable directory (automatic discovery) or register in `src/llm/providers/registry.ts`.
4. No modifications elsewhere. The system discovers and loads providers dynamically.

**Phase 2 Achievements**:

- ✅ Dynamic provider discovery with manifest system
- ✅ Provider lifecycle management (initialize, dispose, health checks)
- ✅ Capability-based provider selection
- ✅ Dependency resolution between providers
- ✅ Hot-reloading without extension restart

**Example provider structure (Phase 2)**:

```typescript
// src/llm/providers/newprovider.ts
import { LLMProvider, ProviderConfig, ProviderMetadata } from "../types";

export class NewProvider implements LLMProvider {
  id = "newprovider";
  name = "New Provider";
  requiresApiKey = true;

  async initialize(): Promise<void> {
    // Provider initialization logic
  }

  async dispose(): Promise<void> {
    // Cleanup logic
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // Health check implementation
  }

  getCapabilities(): ProviderCapabilities {
    return {
      maxTokens: 4096,
      supportedLanguages: ["typescript", "python"],
      features: ["streaming", "function-calling"],
      documentationTypes: ["javadoc", "jsdoc", "pydoc"],
      complexity: { min: 1, max: 10 }
    };
  }

  getMetadata(): ProviderMetadata {
    return {
      id: "newprovider",
      name: "New Provider",
      version: "1.0.0",
      description: "A new LLM provider for Qwiki",
      author: "Your Name",
      homepage: "https://github.com/yourname/newprovider",
      capabilities: this.getCapabilities(),
      dependencies: [],
      minQwikiVersion: "2.0.0",
      entryPoint: "./newprovider.js"
    };
  }

  generate: async (prompt, options) => {
    // Provider-specific implementation
  };

  listModels: () => ["model1", "model2"];

  getUiConfig: () => ({
    apiKeyRequired: true,
    customFields: [{ key: "model", label: "Model", type: "select", options: ["model1", "model2"] }],
  });
}
```

**Provider Manifest (Phase 2)**:

```json
{
  "id": "newprovider",
  "name": "New Provider",
  "version": "1.0.0",
  "description": "A new LLM provider for Qwiki",
  "author": "Your Name",
  "homepage": "https://github.com/yourname/newprovider",
  "capabilities": {
    "maxTokens": 4096,
    "supportedLanguages": ["typescript", "python"],
    "features": ["streaming", "function-calling"],
    "documentationTypes": ["javadoc", "jsdoc", "pydoc"],
    "complexity": { "min": 1, "max": 10 }
  },
  "dependencies": [],
  "minQwikiVersion": "2.0.0",
  "entryPoint": "./newprovider.js",
  "manifestVersion": "1.0",
  "checksum": "sha256-hash-of-provider-files"
}
```

**Future Vision (Phase 3+ Plugin System)**:

1. **Provider Self-Registration**: Providers register themselves dynamically
2. **Runtime Discovery**: No core code modifications needed
3. **Capability-Based**: Providers declare their capabilities and requirements
4. **Hot-Pluggable**: Add/remove providers without restarting
5. **Plugin Marketplace**: Third-party provider distribution

## Code Style Guidelines

### 1. General Rules

- No comments in the code (code should be self-explanatory)
- Keep functions small and focused
- Use descriptive variable and function names
- Follow TypeScript best practices
- Use barrel imports for cleaner import statements

### 2. File Organization

- Use index.ts files for barrel exports
- Group related files in directories
- Follow the established naming conventions
- Keep file structure consistent with the architecture

### 3. Error Handling

- Use custom error classes from `src/errors/`
- Implement proper error recovery
- Provide meaningful error messages to users
- Use the global error handler for consistent error processing

## Common Tasks

### 1. Adding a New Command

1. Create command class in `src/application/commands/`
2. Implement the `Command` interface
3. Register the command in `CommandRegistry`
4. Add command to constants
5. Update webview to call the new command

Example:

```typescript
// src/application/commands/NewFeatureCommand.ts
export class NewFeatureCommand implements Command {
  async execute(...args: any[]): Promise<any> {
    // Implementation
  }
}

// Register in CommandRegistry
container.register("newFeatureCommand", () => new NewFeatureCommand());
commandRegistry.register("newFeature", "newFeatureCommand");
```

### 2. Adding a New Service

1. Create service class in `src/application/services/`
2. Define service interface if needed
3. Register service in `AppBootstrap`
4. Inject service where needed

Example:

```typescript
// src/application/services/NewService.ts
export class NewService {
  constructor(private dependency: Dependency) {}

  async performAction(): Promise<Result> {
    // Implementation
  }
}

// Register in AppBootstrap
container.register("newService", () => new NewService(container.get("dependency")));
```

### 3. Adding a New Repository Implementation

1. Create implementation in `src/infrastructure/repositories/`
2. Implement the repository interface from domain layer
3. Register implementation in `AppBootstrap`

Example:

```typescript
// src/infrastructure/repositories/NewRepositoryImpl.ts
export class NewRepositoryImpl implements NewRepository {
  async save(data: Data): Promise<void> {
    // Implementation
  }
}

// Register in AppBootstrap
container.register("newRepository", () => new NewRepositoryImpl());
```

## Debugging

### 1. Extension Debugging

1. Set breakpoints in your TypeScript code
2. Press F5 to launch the extension in debug mode
3. Use the VS Code debugger to step through code
4. Check the Debug Console for extension output

### 2. Webview Debugging

1. Open the Qwiki webview in the extension
2. Right-click in the webview and select "Inspect" to open DevTools
3. Use DevTools for webview debugging (Vue components, network, console)
4. Use Vue DevTools extension for better Vue debugging

### 3. Common Issues

- **Extension not loading**: Check the extension.ts file for errors, verify all dependencies are installed
- **Commands not working**: Verify command registration in CommandRegistry and constants
- **Services not available**: Ensure proper DI registration in AppBootstrap
- **Webview not communicating**: Check MessageBus implementation and webview message handling
- **LLM provider errors**: Verify API keys are properly stored and provider configuration is correct
- **Build errors**: Ensure webview UI is built (`pnpm run build:webview`) before compiling extension

## Performance Considerations

### 1. Caching

- Use cached services for expensive operations
- Implement TTL-based caching where appropriate
- Cache webview messages to reduce communication overhead

### 2. Lazy Loading

- Services are lazy-loaded by default
- Use lazy loading for heavy initialization
- Consider lazy loading for webview components

### 3. Memory Management

- Dispose of resources properly
- Clean up event listeners
- Use weak references where appropriate

## Contributing Guidelines

### 1. Before Submitting

1. Ensure your code follows the project's style guidelines
2. Verify functionality in development environment
3. Update documentation if necessary

### 2. Pull Request Process

1. Create a feature branch from main
2. Make your changes following the established patterns
3. Verify functionality in development environment
4. Submit a pull request with a clear description
5. Address any feedback from code review

### 3. Code Review

- Focus on architecture adherence
- Check for SOLID principles violations
- Verify error handling implementation
- Ensure performance considerations are addressed

## Resources

### 1. Documentation

- [Architecture Documentation](./ARCHITECTURE.md)
- [SOLID Principles Implementation](./SOLID_PRINCIPLES.md)
- [VS Code Extension API](https://code.visualstudio.com/api)

### 2. Tools

- [VS Code Extension Development](https://code.visualstudio.com/api/get-started/your-first-extension)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vue.js Documentation](https://vuejs.org/guide/) (for webview UI)
- [Pinia State Management](https://pinia.vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/vue Components](https://www.shadcn-vue.com/)
- [Vite Build Tool](https://vitejs.dev/)

### 3. Best Practices

- [Clean Code Principles](https://clean-code-developer.com/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Design Patterns](https://refactoring.guru/design-patterns)

## Getting Help

If you need help:

1. Check the existing documentation
2. Look at similar implementations in the codebase
3. Ask questions in team channels
4. Create an issue for bugs or feature requests

## Quick Reference

### Common File Locations

- Commands: `src/application/commands/`
- Services: `src/application/services/`
- Repositories: `src/infrastructure/repositories/`
- LLM Providers: `src/llm/providers/`
- Constants: `src/constants/`
- Error Classes: `src/errors/`
- Webview UI: `webview-ui/src/`
- DI Container: `src/container/Container.ts`
- Extension Entry: `src/extension.ts`

### Common Patterns

- **Command Pattern**: All user actions
- **Repository Pattern**: Data access
- **Factory Pattern**: Object creation
- **Dependency Injection**: Service management
- **Event System**: Loose coupling

### Key Classes

- `CommandRegistry`: Command management
- `Container`: Dependency injection
- `MessageBus`: Webview communication
- `EventBus`: Event system
- `AppBootstrap`: Application initialization

Remember: The goal is to maintain clean, modular, and maintainable code following SOLID principles. When in doubt, look at existing implementations for guidance.
